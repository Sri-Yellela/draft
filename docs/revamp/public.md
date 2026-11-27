Status: M1–M3 done (47j, lane w2-public) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 · #16 — THE PUBLIC PAGES (signed out) · M1 inventory + M2 brief

Read from the code on 2026-11-26 (47j, lane *w2-public*, from local `main` `a393442e`). Client paths are under
`client/src/`; server paths from the repo root. **Nothing live changes in this lane** — Wave 2 can't ship while Wave 1 #8 is
unlanded (`d197Wave2WaitsForWave1`); this file + the dev mocks are M1–M3 only.

Mocks (M3, Admin only): **`/dev/plate?page=public-jobs`** (the signed-out market) and **`/dev/plate?page=public-chrome`**
(the signed-out nav + footer, which every page below wears) — add `&w=390` for the phone.

D200 Rule 1: element · what it does today · file:line · **where it lives in the plate page** (M2). ⛔ Two rules hold on
EVERY row: **(a) SEO stays** — D128 / D179 (JSON-LD, canonical, sitemaps, IndexNow, real 404s for thin / missing pages,
the signed og image) — and **(b) no user data on a public page** (no match %, no résumé marks, no Starred / Imported, no
person's name except a public profile's own). A plate page that drops either is a regression, not a redesign.

---

## 0 · Which public pages there are, and who draws them

| Route | Drawn by | Today's chrome | Notes |
| --- | --- | --- | --- |
| `/jobs` | client: `pages/jobs/PublicBoardPage.jsx` (266 lines) | classic marketing `NavBar` (`App.jsx:1098-1102`) | signed in → `Navigate /app/jobs` (`App.jsx:1099-1100`) |
| `/jobs/<slug>` | **server**: `services/jobs/publicJobPage.js` `renderPublicJobPage` (`server.js:11326-11332`) | its own `<header class="site">` (`/draft` + Sign in) | A157: always a 301 to `/<company>/<id>` now (`server.js:11328-11329`); reached inside the client router → `FromServer` reloads it (`App.jsx:894-898, 1103`) |
| `/<company>/<id>`, `/companies/<company>/<id>` | **server**: the same renderer (`server.js:17778-17790`) | the same | the client's `CompanyJobRoute` 404s a non-numeric id (`App.jsx:926-931, 1120`) |
| `/jobs/role/<id>`, `/jobs/role/<id>/in/<metro>`, `/jobs/tech/<slug>` | **server**: `services/jobs/landingPages.js` `renderLandingPage` on the offload worker (`server.js:11281-11296`) | the same `site` header | D179 P7 — a real 404 under `MIN_JOBS` = 10 (`landingPages.js:23, 103-105`) |
| `/jobs/sponsor-h1b/<id>`, `…/in/<metro>` | **server**: the same renderer, `kind: sponsor` (`server.js:11293-11295`) | the same | **D185-6 the sponsorship landing pages** |
| `/learn/data-engineering-roadmap` | **server**: `services/learn/roadmapPage.js` `renderRoadmapPage` (`server.js:11297-11302`, `ROADMAP_PATH` `roadmapPage.js:16`) | the same `site` header | **D193-5** — not a client route; deck files only, no DB read |
| `/<company>` (signed out) | client: `pages/companies/CompanyPage.jsx` → `plate/SurveySheet.jsx` (`App.jsx:1115-1119, 909-915`) | classic marketing `NavBar` above the **plate** survey sheet | `/companies/<slug>` → 301 `/<slug>` server-side (`server.js:17773-17777`) and client-side (`App.jsx:900-907`) |
| *Why Atlas* (research page) | **doesn't exist** | — | brief only (§6) |

The classic `NavBar` (`components/NavBar.jsx`) and `Footer` (`components/Footer.jsx`) are inventoried in §5 — the M2 for
both is the mock `public-chrome`.

---

## 1 · `/jobs` — the open board (`pages/jobs/PublicBoardPage.jsx`)

APIs: `GET /api/public/jobs?<params>` (`server.js:11191-11194`, `publicBoardPage` on the read pool, 60 s cache) ·
`GET /api/public/jobs/facets?<params minus category/subcategory/page>` (`:11195-11198`, 300 s) ·
`GET /api/public/jobs/entry` (`:11200-11203`, 300 s) · `GET /api/public/suggest?q=&kind=` (`:11247-11251`, via
`components/UsbSuggest.jsx:70`) and `GET /api/jobs/suggest?field=title&q=` (`UsbSuggest.jsx:55`, the titles list; 401 →
the grouped list only). All behind `publicLimit` = 120 / min / IP (`server.js:11190`). No session read on any of them.

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | URL state | `q · category · subcategory · tech · places · work_models · experience_levels · page · view` in the query; any change except `page` resets `page` | PublicBoardPage.jsx:16, 96-113 | the same query keys (bookmarks, the landing pages' *Browse and filter all N* links and the sitemap's `/jobs` keep working) |
| ☐ | Title `<h1>` | *N open jobs* (+ *in <role>*), *Open jobs* before the count | :150 | **the one-line header** (D200): serif 40 px *"12,480 open jobs"* + *in Backend engineering*; kicker *THE MARKET · OPEN TO EVERYONE · WEEK 48* |
| ☐ | *N new this week* (entry only) | live count from `/entry` | :151 | the stats strip's **NEW THIS WEEK** cell (answers: → `/jobs?sort=new` ⚠ no such sort today → it narrows to page 1 = newest, as the board orders) |
| ☐ | Lead + *Sign up* link | *Every job on draft, open to read. Sign up to save one…* | :152 | the lead line under the header; *Sign up* → `/register` (the page's ONE clay point is *Get started*, so this is an ink link) |
| ☐ | Search (`UsbSuggest`, `field="title"`) | one box; grouped dropdown Companies · People · Roles · Technologies · Titles (A148 scope labels head it on focus); Enter → `q`; a role → `subcategory + category`; a tech → `tech`; a company → its page | :156-167; UsbSuggest.jsx:64-186 | the plate **NavSearch** row (`plate/Shell.jsx` `NavSearch`, `renderInput` keeps UsbSuggest's input + dropdown — one implementation) with placeholder *Company, role, tech or title…* |
| ☐ | Role picker *Any role ▾* / *<role> ▾* | opens Category → Subcategory with TRUE counts; *All of <category>*; *N not yet sorted into a role* | :168-170, 175-199 | the **Cartouche** (the bearing, signed out): *"discovering **any role** roles, at **any** level, **any** workstyle, **anywhere**, using **any** technology"* — each part a button opening the same picker as a `pl-menu` drop; the counts stay |
| ☐ | *using <tech> ×* | clears `tech` | :171 | the cartouche's *using <tech>* part + an active chip (`MarketFilterRow`'s active chips, ×) |
| ☐ | *Clear* | clears category, subcategory, q, tech | :172 | the active-chips row's *Clear all* |
| ☐ | Entry board (nothing searched, page 1) | Popular roles (subcategories ≥ 10 jobs → `/jobs/role/<id>`), Browse by role (8 categories × top 3 subs, each narrows in place), Hiring by technology (chips, each sets `tech`), Companies hiring now (→ `/companies/<slug>`, *N open · N new this week*), *Every open job* heading | :40-93, 138-145, 201 | **The political map, signed out** (`plate/MarketMap.jsx`): territories = the categories (area = open jobs, from facets) — tap = the Role filter, as signed in; NO hatching (hatching = *fits you*, personal) and NO *you* marker. Under it, three **Gazetteer** sections: *Popular roles* (→ landing pages), *Hiring by technology* (`FilterChips` with counts), *Companies hiring now* (rows → survey sheets). The map's capitals = companies hiring most (public data) |
| ☐ | Error line | *A lot of searches at once — try again in a minute.* (429) / *The board couldn't load just now* | :119, 203 | `plateState` error on the openings (`ErrorLine`, Try again re-requests) — the 429 words kept |
| ☐ | Loading | *Loading…* `aria-busy` | :204 | `plateState` loading (paper skeleton) |
| ☐ | Empty | *Nothing open matches that. See every job* (clears the filters) | :205 | `plateState` empty (dashed drawer) with the action *See every job* |
| ☐ | View switch Deck · List (`?view=list`) | | :207-212 | **BinderTabs**: *Deck · ONE AT A TIME* / *Index · EVERY OPENING* (the signed-in market's names; `view=list` still selects Index) — no *Terrain* signed out (it plots match, which needs a résumé) |
| ☐ | Deck card (`DeckView` `CardFace`, no score) | the posting as the deck's own card, without personal parts | :214-224 | an **Opening** ticket (`plate/Tickets.jsx`) with `match: null` and NO résumé marks on the stack (see the M2 note on `Opening`'s *ON YOUR RÉSUMÉ* label) |
| ☐ | ‹ (back) | previous card | :227 | the deck's ‹ (MarketPager / deck position) |
| ☐ | Pass | next card; past the page's end → next page | :219, 228 | *Pass* on the ticket's actions |
| ☐ | Save | → `/register?returnTo=<posting path>` | :229 | *Save* → the same |
| ☐ | Read it | the posting's public page (`j.path`) | :230 | *Read it* (the title is also the link) |
| ☐ | Draft (primary) | → `/register?returnTo=…` | :231 | *Draft* — ink primary (the clay point is the nav's *Get started*; see the clay note) |
| ☐ | *n of total* | the deck position | :232 | the deck position line (`pl-deckpos`) |
| ☐ | List rows | `<ol start>`: title → posting page; company → `/companies/<slug>`; location · workplace · salary · *posted N days ago*; Save / *Draft my résumé* → `/register?returnTo` | :238-255 | the **Gazetteer** (Index): # · OPENING · COMPANY · PLACE · PAY · POSTED · ACT (Save / Draft) — no MATCH, no STACK·YOURS, no STATUS column |
| ☐ | Sign-up band after the 10th row | *Draft tailors your résumé to each of these and applies for you. Sign up free* | :251 | a **Ticket** (`tone="clay-tint"`) after row 10: *SIGN UP FREE · Draft tailors your résumé to each of these* → `/register` |
| ☐ | Pages ‹ Newer / *Page n* / Older › | | :257-263 | **MarketPager** |
| ☐ | Signed in | sent to `/app/jobs` | App.jsx:1099-1100 | unchanged |
| ☐ | SEO | `/jobs` in `/sitemap.xml` hourly 0.9; robots `Allow: /jobs/` | server.js:11338, 11374-11375 | unchanged (the page is a client page; its server routes are untouched) |

## 2 · A posting's public page (server-rendered, `services/jobs/publicJobPage.js`)

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | Address | `/<company>/<id>` (A157); `/jobs/<slug>` → 301 there | server.js:11326-11332, 17778-17790 | unchanged |
| ☐ | `<title>`, description, canonical, og:title / url / type, the signed og image | | publicJobPage.js:255-262 | unchanged (the head is SEO, not look) |
| ☐ | **JobPosting JSON-LD** while open; closed → `noindex` + no structured data | | :258, :263; `jobPostingJsonLd` :149-182 | unchanged ⛔ |
| ☐ | Header `/draft` → `/`, *Sign in* → `/login` | | :265 | the **public nav** in server HTML (the same markup as `PublicNav`, written as a string — the server can't render React; one class set, `plate.css` served as a static file — M5 decides the delivery) |
| ☐ | *This posting has closed* card | | :267 | a **Stamp** *CLOSED* + one line (the plate's "not yet" dashed drawer look) |
| ☐ | Title `<h1>`, facts *company · workstyle · location · salary* | | :268-269 | the **opening sheet**'s hero (D199 C7 — `plate/OpeningSheet.jsx` `OpeningSheetView`, `still` mode, no FitCard): the 82 px serif title, kickers, the facts line |
| ☐ | *Posted by <company> on their careers site · View the original posting* (`rel="noopener nofollow"`) | credits + links the employer | :270 | the sheet's *Original posting ↗* line (kept verbatim — the credit is a D128 promise) |
| ☐ | **Draft this job** → `/register?returnTo=<path>` (`ctaHref` override) | | :271 | the sheet's primary action — **the page's clay point** |
| ☐ | *draft's reading*: level + years + disagreement, liveness label, **ghost line** (D137 P3, *Likely not hiring* with reasons), skills as marks, **visa sponsorship** line + notice | | :244-253, 272 | sheet section **01 · What they ask for** (skills as `StackChip`s, *yours* never set) + **02 · Is it real** (liveness + ghost words verbatim) + the **FILED H-1B** stamp that opens the filings popover (`H1bStampPopover`, public data) |
| ☐ | *In the Atlas* links (`atlasLinksFor`) → `/atlas/<slug>` | | :191-218, 273 | onward **Tickets**: *Learn <skill> → Atlas* (the interchange) |
| ☐ | *The posting, as <company> wrote it* (`descriptionHtml`), fallback *couldn't be read — see the original* | | :274-276 | the sheet's posting section (`postingSections`, OpeningSheet.jsx:57) |
| ☐ | Missing posting: 404 *This posting isn't here … See how draft finds, tailors and applies* (→ `/try` → `/`) | real 404, `noindex` | :220-227 | **Off the map** (`errors.md`) in server HTML — keeps the 404 status + `noindex`; the link goes straight to `/` (`/try` is a redirect since 11-07) |

## 3 · Landing pages — role, role in a metro, technology, and D185-6 sponsorship (`services/jobs/landingPages.js`)

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | Routes | `/jobs/role/:id`, `…/in/:metro`, `/jobs/sponsor-h1b/:id`, `…/in/:metro`, `/jobs/tech/:slug` | server.js:11291-11296 | unchanged |
| ☐ | Thin / unknown → **404**, *Not enough open jobs here yet. Browse every open job* (`noindex`) | no thin pages (D179 (7)) | landingPages.js:103-105 | **Off the map** in server HTML (404 + noindex kept), its one way back = *Browse every open job* |
| ☐ | `<title>` *<role> jobs — N open*, description, canonical, og, the signed og image | | :106-118 | unchanged |
| ☐ | **ItemList JSON-LD** of the shown rows | | :110-111, 119 | unchanged ⛔ |
| ☐ | `<h1>` heading; facts *N open · <lead>* | role: *<Role> jobs*; metro: *… in <place>*; sponsor: *<sentence>* + *employers with certified H-1B filings*; tech: *Jobs using <tech>* | :41-99, 123-124 | **a gazetteer sheet** (D197 #16's idea): the serif title (a destination — 82 px is allowed), a kicker *GAZETTEER · <CATEGORY> · <ROLE> · <PLACE>*, a **StatsStrip** of real counts (OPEN NOW · NEW THIS WEEK ⚠ not computed today — only if counted · EMPLOYERS) — no figure that isn't counted |
| ☐ | **Browse and filter all N** → `/jobs?<same filter>` | the board with the same filter | :125 | the sheet's primary action → the same `boardHref` |
| ☐ | *The newest* (40 rows: title → posting page, company · location) | | :126-128 | a **Gazetteer** (OPENING · COMPANY · PLACE · POSTED) |
| ☐ | D185-6 *Their H-1B filing history* (per employer: certified filings, latest, open here) + the DOL source line + *history, not a promise* + `NOT_LEGAL_ADVICE` | | :134-141 | section **02 · Who has filed** — a Gazetteer of employers + the **FILED H-1B** stamp per row (opens `H1bStampPopover`); the source line and *not a promise* verbatim under it |
| ☐ | `/sitemap-landing.xml` (pages passing `MIN_JOBS`), listed in `/sitemap-jobs.xml`'s index | | server.js:11267, 11303-11306; landingPages.js:144 | unchanged ⛔ |
| ☐ | Offload worker render + 1800 s cache; 503 + Retry-After when busy (A158) | | server.js:11281-11288 | unchanged (the plate HTML is still a string from the worker — no per-request React) |

## 4 · `/learn/data-engineering-roadmap` (D193-5, `services/learn/roadmapPage.js`)

Served by `app.get(ROADMAP_PATH, …)` (`server.js:11297-11302`), server-rendered from the approved deck files
(`approvedDecks()`), 3600 s cache; in `/sitemap.xml` monthly 0.7 (`server.js:11340`). Not a client route.

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | `<title>` *Data engineering roadmap 2027*, description, canonical, og (`article`), the signed og image | | roadmapPage.js:68-77 | unchanged |
| ☐ | **ItemList JSON-LD** of every linked deck (→ `/atlas/library/<deck>`) | | :65-67, 79 | unchanged ⛔ |
| ☐ | `<h1>` + facts *11 stations, in the order to learn them · N short lessons* | | :83-84 | a **route sheet**: the serif title, kicker *ROUTE · VOL. I · DATA ENGINEERING*, StatsStrip (STATIONS · LESSONS) — counted from the served decks only |
| ☐ | *Start here: <first deck>* preview — three points one at a time, CSS only, no sound; instant under reduced motion; then **Sign up to keep learning** → `/login` | D194 P4 | :49-58, 85-89 | a **field-note card** (`FieldNoteCard`, `Cards.jsx`) playing the three points; the sign-up as the clay-tint **Ticket** after it |
| ☐ | *The route*: 11 stations (n · name · line · deck links / *In the course: …* for Git and Linux) | | :21-33, 70-72, 90-92 | the **RouteLine** (`Lists.jsx`) — stops = stations (stage colours by order: Start 1-3 · Build 4-6 · Deepen 7-9 · Master 10-11), each stop's decks as links under it; a station with no served deck reads as text (no dead link) |
| ☐ | **Follow this route in draft** → `/login` | | :93 | onward ticket → `/register` (⚠ today `/login`; the owner decides at M4 whether it signs up or in) |

## 5 · The public survey sheet (`/<company>` signed out) — the M2 is the CHROME

The body is already the plate `SurveySheet` (Wave 1 #4 — `docs/revamp/survey.md` owns its rows); signed out it gets
`inApp=false`, `applyOpen = () => {}` (no Pending list), no `/match`, no network calls (`CompanyPage.jsx:49-67, 93`).

| ☐ | Element | What it does today | file:line | Where it lives now (M2) |
| --- | --- | --- | --- | --- |
| ☐ | Classic `NavBar` above the sheet | marketing nav (§5b) | App.jsx:1110, 913 | **`PublicNav`** (mock `public-chrome`) — the plate nav, paper ground, ruler; the sheet sits on the same paper (no theme leak) |
| ☐ | No footer | — | — | **the public footer** (`AtlasFooter` with `brand`, mock `public-chrome`) |
| ☐ | Missing company → *We don't have a page for this company. Browse open jobs* | | CompanyPage.jsx:86-87 | **Off the map** (`errors.md`), way back *Browse open jobs* → `/jobs` |
| ☐ | Load error *This page couldn't load just now* | | :88 | `ErrorLine` with Try again |
| ☐ | Loading *Loading…* | | :89 | the sheet's `plateState` loading |
| ☐ | Bad / reserved slug → `NotFoundPage` under the nav | | App.jsx:909-915 | **Off the map** |
| ☐ | `/companies/<slug>` → 301 `/<slug>` (reserved words keep `/companies/`) | | server.js:17773-17777; App.jsx:900-907 | unchanged |
| ☐ | SEO: `/sitemap-companies.xml` | | server.js:11307-11310 | unchanged. ⚠ **found:** the public company page has **no JSON-LD, no og tags and no server-rendered head** — it is the SPA shell's `index.html`. Not a regression of this lane; listed for the owner (an `Organization` JSON-LD + og through the same head-injection the audit uses, `server.js:17755-17771`, would be the M5 fix) |

### 5b · The classic signed-out chrome (`components/NavBar.jsx`, `components/Footer.jsx`, `components/MarketingFrame.jsx`)

| ☐ | Element | What it does today | file:line | Where it lives now (M2: `PublicNav` / the public footer) |
| --- | --- | --- | --- | --- |
| ☐ | Logo (`StampLogo`, full wordmark ≥ 768 px, initial below) → `/` | | NavBar.jsx:40-43 | the **Wordmark** `/draft` (clay slash) → `/`; on a phone the `/d` tile |
| ☐ | Links: Products · Atlas · Pricing (only while monetisation is on) · About · Blog; active = current path | | :15-22, 46-53 | `PublicNav` links: **Jobs** (`/jobs` — ⚠ missing from today's nav; proposed) · **Atlas** · **Companies** ⚠ (no public index page today — proposed only if one is built; otherwise dropped at M4) · **Pricing** (lever) · **About** · **Blog**; `aria-current="page"` on the current. *Products* → see `marketing.md` (a "coming soon" page) — the owner strikes or keeps it |
| ☐ | Signed in: Dashboard → `/app`, Admin (admins), Sign Out | | :56-66 | `PublicNav` `user` state: *Open draft* → `/app`, *Admin* (admins), *Sign out* — same calls |
| ☐ | Signed out: **Sign In** (opens `InlineLoginPopover` — sign in without leaving the page) · **Get Started** → `/register` | | :68-77 | *Sign in* (the same popover, anchored to the nav's button) · **Get started** — the page's ONE clay point |
| ☐ | Phone: hamburger (☰ / ✕, `aria-expanded`) → drawer: the links, divider, Sign In (→ `loginHref()`, back to this page after) / Create Account, or Dashboard / Admin Panel / Sign Out; closes on route change | | :34-35, 80-118 | `PublicNav` `phone`: the `/d` tile, *Get started*, a *Menu* button → a `pl-menu` drop with the same items; Esc / outside press closes (AreaNav's behaviour) |
| ☐ | Footer: logo + *Find the job. Fit the résumé. Apply.* + *© 2025 draft* | | Footer.jsx:16-29 | the footer brand + line; © year from the clock (⚠ today hard-coded 2025) |
| ☐ | Footer Product: Features · How It Works · Browser extension · Pricing (lever) · FAQ | | :31-53 | footer column *Product* (same links) |
| ☐ | Footer Company: About · Contact · Privacy Policy · Terms of Service | | :55-76 | footer column *Company* (same) |
| ☐ | Footer on which pages | only inside `MarketingFrame` (`MarketingFrame.jsx:68`) — `/jobs`, `/<company>`, `/audit`, the landing, 404 have none | MarketingFrame.jsx:9, 68 | **every public page** gets the footer (proposed) — adds *Open jobs* + *Atlas* + *Data engineering roadmap* to a third column *Explore* so the server pages are linked from the client ones |

---

## 6 · M2 — THE BRIEF (the page recipe, D196 addendum, D200)

**Atlas name.** The signed-out pages keep **the same names** as signed in (D197 #16): the market (`/jobs`), an opening (a
posting's page), a survey sheet (a company). The landing pages become **gazetteer sheets** — one sheet per place in the
market's political map (a role, a role in a metro, a technology, a sponsorship slice), each with real counts. The roadmap is
a **route sheet** (D203: a route = a saved order of entries). The research page is **Why Atlas** — *a field report*. The
chrome is the **public nav** (wordmark, links, Sign in, Get started, the ruler) and the **public footer**.

**Parts:** the one-line header (working page) or the big serif title (destination) · the stats strip · the cartouche
(signed-out bearing) · the political map (no hatching, no *you*) · binder tabs Deck / Index · openings · the gazetteer ·
onward tickets · the public nav · the public footer.

**Palette.** One region per page: **the market and the landing pages wear Region IV** (Systems & networks, navy — the
market's own, `PlateRoot region="IV"` as the signed-in market does); a role landing page wears its **sector's nearest
region** (`plate/marketPlate.js` `sectorRegion`); the roadmap wears **Region IV** (data engineering sits nearest
*Systems & networks*; the owner confirms at M4). Clay = the one *Get started* / *Draft this
job*; **green never appears signed out** (nothing is proven for a visitor).

**The single clay point.** `/jobs` and every landing page: **Get started** in the public nav (the deck's *Draft* and the
sign-up ticket stay ink / clay-tint). A posting's page: **Draft this job**. The roadmap: **Sign up to keep learning**. The
survey sheet: its own (Wave 1 #4) — the nav's *Get started* turns ink there so the sheet keeps one clay point.

**Hero plate.** `/jobs`: the **political map** (`MarketMap`, the territories = the categories, area = open jobs, capitals
= the companies hiring most) with the stats strip (OPEN JOBS · NEW THIS WEEK · COMPANIES · FILED H-1B). A landing page: the
same map **zoomed to its territory** (D199 C5's zoom), the territory outlined — ⚠ drawing exists (`MarketMap`), the
zoom-to-one-territory state is **to build** at M5. A posting: the **TeamDiorama** (D199 C7, as the opening sheet). The
roadmap: **drawing needed** — *the route drawn across the terrain* (a RouteLine is a list, not a plate) → placeholder
`UnchartedPlate` until drawn. Why Atlas: the **AtlasVolumePlate** (`plate/drawings/AtlasVolumePlate.jsx`).

**Sections, one drawing each.**
- `/jobs`: 01 *Where the openings are* — `MarketMap` · 02 *Every opening* — the deck (`MarketBoardOrder` drawing beside the
  Index) · 03 *Popular roles · technologies · companies* — **drawing needed** (*a gazetteer page with grid letters*) →
  placeholder.
- Gazetteer sheet: 01 *The newest* — `MarketBoardOrder` · 02 (sponsor only) *Who has filed* — **SurveyHiringProfile**
  (the filings-by-year profile, already the survey sheet's) · 03 *Where to go next* — onward tickets.
- Posting: the opening sheet's sections (D199 C7).
- Roadmap: 01 *Start here* — the field-note card · 02 *The route* — `RouteLine` · 03 *Follow it* — ticket.
- Why Atlas: 01 *Proof over progress* — `PlaceSignpost` · 02 *Two maps* — `MarketTerrain` beside `AtlasVolumePlate` ·
  03 *What we measured* — **drawing needed** (a survey chart: completion vs explanation) → placeholder.

**The one operable model.** `/jobs`: **the political map** (tap a territory = the Role filter, zoom, keyboard — D199 C5's
interactions) — the deck is the second view, not the model. Gazetteer sheet: the **Gazetteer** (sort by posted / company).
Roadmap: the **RouteLine** (a stop opens its decks). Why Atlas: the **Register** — a one-question check (*"Which lights a
square: opening a lesson, or explaining it?"*) that goes green with LIT — the page's argument, acted out.

**Squares.** None signed out (squares are proof; a visitor has none). The roadmap's stops show *ahead* squares (dashed)
with *Sign up to light them* — never lit.

**Onward tickets.** `/jobs`: *Check a résumé, no account* (`/tools/ats`) · *The 3-minute audit* (`/audit`) · *Atlas*
(`/atlas`). Posting: *Survey sheet · <company>* · *Learn <skill> → Atlas* · *More <role> jobs* (its landing page).
Gazetteer sheet: *Browse and filter all N* · the metro / sponsor sibling pages · *Atlas: what <role> asks for*. Roadmap:
*Open the Library* · *Sign up*. Why Atlas: *Open Atlas* · *Sign up*.

**Rows whose home is unclear (for the owner at M4):** the posting / landing / roadmap pages are **server HTML strings** —
the plate look reaches them only as a served stylesheet + the same class names (no React on the server). Either (a) a small
SSR of the plate components on the offload worker, or (b) hand-kept HTML in the plate classes with a guard that the class
set matches the library — the owner / M5 picks. · *Products* and *Blog* on the nav (both "coming soon" pages). · A public
*Companies* index (`/api/public/companies` exists, A144, but no public page draws it). · The roadmap's *Follow this
route* → sign-in or sign-up.

### 6b · *Why Atlas* — a research page (doesn't exist; brief only)

A public, server-rendered **field report** at `/learn/why-atlas` (proposed address; in `/sitemap.xml`; an `Article`
JSON-LD). Its point, in the design doc's own words: *proof over progress* — a square lights only when you can explain it.
Sections: 01 *What a square means* (PlaceSignpost: "opened it" ✗ / "explained it" ✓) · 02 *Two maps* (the physical map you
climb vs the political map of openings — D200) · 03 *What we measured* — **only figures counted from draft's own data**
(Atlas checks attempted / passed, audit results) with their dates; no figure that isn't counted (the voice rule) ·
04 *How it's made* (the Library's primary sources, the decks, the no-AI-judging-fit line from the landing's promises).
⚠ **owner:** what research it reports — draft's own numbers only, or cited studies on retrieval practice (the Library's
catalogue cards could carry them, with their call numbers). Nothing is built.

---

## 7 · Mocks (M3) and library pieces

- `client/src/pages/dev/platePages/PublicJobs.jsx` — `public-jobs`: PublicNav · one-line header + stats · the cartouche ·
  the political map (no hatching, no you) · Deck / Index binder tabs (an Opening with no match; a Gazetteer without match
  columns) · the sign-up ticket · popular roles / technologies / companies · onward tickets · the footer. Synthetic
  companies only (Kestrel Payments, Northwind Analytics, Halcyon Robotics … — the canvas's).
- `client/src/pages/dev/platePages/PublicChrome.jsx` — `public-chrome`: PublicNav signed out / signed in / phone with the
  menu open, the footer, and the three server pages' headers drawn with it (posting · gazetteer sheet · roadmap) so the
  owner sees the chrome on each.
- **Library (new):** `PublicNav` (`plate/PublicPages.jsx`, registry entry) · `UnchartedPlate` (the labelled placeholder for
  a drawing to come, `plate/PublicPages.jsx`) · `AtlasFooter` gained an optional `brand` (default *Atlas*) so the public
  footer is the same footer (A93: built once).
- ⚠ **`Opening` signed out:** its stack label reads *WORKS WITH · ✓ ON YOUR RÉSUMÉ* (`Tickets.jsx`) — false for a visitor.
  The mock passes no stack; M5 adds a `signedOut` wording (*WORKS WITH*) to the library piece.

## M5 · What was built (47m, lane public — the 47n record)

- **The public chrome** (`components/PublicChrome.jsx`: PublicNav + auth + the sign-in popover, PublicPage), the public
  footer and `MarketingFrame` on the plate; `NavBar` + `ProductsPage` deleted (⭐ agent's pick: `/products` → `/features`).
- **/jobs** (`pages/jobs/PublicBoardPage.jsx`) from the approved mock *public-jobs* (Region IV): the header + counted stats,
  NavSearch around UsbSuggest, the cartouche + role picker, the political map signed out, Deck / Index binder tabs,
  MarketPager, the gazetteer + its drawing, onward tickets. `PublicBoardPage.css` deleted.
- **Server pages:** `services/publicChrome.js` (the plate chrome + Off the map) for the posting page
  (`services/jobs/publicJobPage.js` — a 404 stays 404 + noindex), the landing pages (`landingPages.js`) and the roadmap.
- **Legal / tools / survey / audit / blog** under the plate public frame — the legal words unchanged; PolicyProse and
  `AuditPage.css` on plate tokens; the apply tool's sign-in gate kept as a plate drawer.
- **Drawings:** the final public + Correspondence drawings ported and in the register.

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).

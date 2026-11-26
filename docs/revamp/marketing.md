Status: M1–M3 done (47j, lane w2-public) · ⏸ awaiting the owner's M4 look · ⚠ every row here is **PROPOSED — owner to place** (none of these pages is in D197's Wave 2 table)

# D197 · public pages NOT in the Wave 2 table — the landing, marketing, the tools, /audit, /survey, /products, /blog, and the in-app Plans and Recruiter · M1 + proposed M2

Read from the code on 2026-11-26 (47j, lane *w2-public*, from local `main` `a393442e`). Paths under `client/src/`. The 47j
probe found these surfaces CLASSIC and in no Wave 2 row. **Proposal (for the owner to place):** fold the landing,
marketing pages, tools, `/audit`, `/survey`, `/products`, `/blog` into **#16 Public pages** (same chrome, same rules: SEO
kept, no user data) as rows **16a–16q**; Plans into **#17 Settings** (16-adjacent: it is a settings page); Recruiter into
**#21 Admin** or struck (D5: there is no recruiter role, it is route-only). **Nothing live changes in this lane.** Mock:
**`/dev/plate?page=landing`** (the landing only).

**The shared chrome today:** pages that render `MarketingFrame` (`components/MarketingFrame.jsx`: eyebrow, serif title,
lede, actions, then the footer, `:55-71`) — Features, How it works, Extension, Pricing, About, Contact, FAQ. Pages
WITHOUT it draw their own (Privacy, Terms, Connector docs, the four tools, `/survey`) or sit under `NavBar` with no footer
(the landing, `/audit`, `/products`, `/blog`). ⛔ **M2 for all of them:** the plate `PublicNav` + the public footer
(`docs/revamp/public.md` §5b, mock `public-chrome`), paper ground, `MkLink` → `pl-btn` (primary = the clay point), `NoteCard`
→ the library `Ticket` / `pl-card`, `MkSteps` → `TrailRail` / `RouteLine`, `Promises` → a ruled list with ✓ / ✗ marks.

Every page keeps: its route, its words (checked against the code — `marketingClaimsHonest46v`, `a233RetiredHouseWords`),
its `data-*` hooks (tests read them), and the monetisation lever (Pricing + tier names only while it is on — "off means
absent").

---

## 16a · The landing `/` (`pages/LandingPage.jsx`, 168 lines) — mock `landing`

Signed out only (signed in → `/app`, admin → `/admin`, `App.jsx:1198-1203`). API: `GET /api/jobs/generic?page=1&pageSize=12`
(`:117`). In `/sitemap.xml` 1.0 weekly (`server.js:11337`).

| ☐ | Element | What it does today | file:line | Proposed home (M2) |
| --- | --- | --- | --- | --- |
| ☐ | `StampLogo` + h1 *10 jobs that fit you, every morning* (`PICKS_A_DAY` = 10, pinned to `services/dailyDraft.js`) | | :28-31, 128-129 | the destination title (82 px serif, clay stop) — the hero of the whole site; kicker *DRAFT · FIND · FIT · APPLY* |
| ☐ | Lede *draft reads every job against your résumé…* | | :130 | the lead, verbatim |
| ☐ | **Sign up free** (primary) → `/register` · *Check a résumé, no account* → `/tools/ats` | | :131-134 | **Sign up free = the page's one clay point**; the ATS link as a paper button |
| ☐ | **Hero deck**: the site's own card dealt from today's public jobs, the next one every 1 s (`DEAL_EVERY_MS`), paused on hover / focus, still under reduced motion; no match shown; two backs behind | | :27, 66-110 | a **DeckPile** of **Opening** tickets (`match: null`, no résumé marks) on the right, dealt the same way (one live detail = the deal; `usePlateMotion` stills it) |
| ☐ | The card's title → `openPosting(job)` (the one way a posting opens) | | :81, 98 | the Opening's title link → the posting's public page |
| ☐ | Pass (next) · Save → `/register` · **Draft** → `/register` | | :103-107 | the ticket's actions (Draft in ink — the clay is Sign up free) |
| ☐ | No jobs: the card's back | | :91 | `plateState` empty: *Today's jobs are on their way* drawer |
| ☐ | **The shelf** — *Everything in draft, on one shelf*: 7 books (Today's picks · Applications · Atlas · Interview · The extension · Ask draft · ATS check), each opens its note below with its link | | :33-50, 139-154 | **the region plates** of the landing (AtlasHome's `RegionPlates` idea): seven plates, each an emblem + name + one line + its link (a plate per part of draft); pressing one opens its note card — ⚠ the books are a drawing the owner chose (46v, *"use the shelf"*): the owner decides shelf (kept, restyled in ink) vs plates |
| ☐ | **C** — *Find the jobs that fit. Apply to them well. Stay in charge of what is sent.* + four figures (10 · 16 sources · 0 AI models reading your résumé · 1 press) + promises (✓ / ✗ list) + Sign up free / *See every open job* | | :52-64, 156-165 | a **StatsStrip** (the four figures, labels verbatim; `SOURCE_COUNT` pinned) + a ruled **promises** list (✓ ink, ✗ struck — the register's right / wrong look) + onward tickets |
| ☐ | Footer | none on the landing today | — | the public footer |

**Proposed M2 · 16a.** Atlas name: **the front door** (the title page of the atlas). Palette: **paper + all eight regions
as chips** (Volume I's way — the landing introduces every part); clay = **Sign up free**. Hero plate: **AtlasVolumePlate**
(the volume plate, already ported) with the deck of openings beside it — ⚠ or the market's **political map**; the owner
picks (a job seeker's first look should probably be the market, not Atlas). Sections: 01 *Ten a day* — the deck ·
02 *Everything in draft* — the shelf / plates (emblems are the drawings) · 03 *What it does, and never does* —
`PlaceSignpost` (does ✓ / never ✗). Operable model: the deck (Pass deals the next). Squares: none. Onward: Open jobs ·
ATS check · Atlas.

## 16b · `/features` (`pages/marketing/FeaturesPage.jsx`, 110)

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | Frame: *Features* / *What each tool is for* / *Get today's draft* → `/register` | | :78-80 | one-line header + the clay *Get started* |
| ☐ | Shelf of every tool (book = tool, head = its station `/find · /fit · /apply`); a press scrolls its note into view | | :82-88 | a **RouteLine** *find → fit → apply* (three stops) — each stop's tools listed under it; a stop press scrolls |
| ☐ | Per station (`MkSection`, *the line*): each tool's note — what it does, the ONE thing it won't do, the honest limit, where / its link; tier label only with monetisation on | | :25-76, 90-108 | per stop a section with a **Ticket** per tool: kicker *STATION /FIT · PLUS* (tier only with the lever), title, *does*, a struck *won't* line, the limit as mono, the link as the go-line |

## 16c · `/how-it-works` (39)

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | Frame *How it works* / *From job listing to submitted application in minutes* / Sign up free | | :31-35 | one-line header; Sign up = clay |
| ☐ | Five steps (Upload · best jobs each day · use the tools (tier wording with the lever) · see how well you fit · Apply), `MkSteps` of NoteCards | | :12-27, 36 | **TrailRail** of five legs (the place page's rail — legs = steps), each with its card; drawing: **PlaceIsometricTile** (a process) |

## 16d · `/extension` (158)

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | **Add to Chrome** (store link, `target=_blank`), or *The Chrome Web Store link isn't published yet* | | :46-61 | the clay button (the page's point) |
| ☐ | D33: the page knows who reads it — `GET /api/auth/me` + `useExtensionStatus`: *Your extension is connected* / *isn't connected* (+ how) / signed out | | :63-130 | a **Stamp** state (*CONNECTED* lit — a proof, green allowed / *NOT CONNECTED* clay-tint ticket with the steps) |
| ☐ | *Imported view on /draft* link `/app/jobs?view=imported` | | :124 | kept |
| ☐ | Four setup steps (Add · Sign in once · Capture Ctrl+Shift+K · Fill Ctrl+Shift+Y) | | :24-33, 150 | **TrailRail**; the shortcuts as `pl-kbd` |
| ☐ | *What it does, and never does* — three facts (you choose what it reads · talks to draft only · you press submit) | | :35-40, 152-156 | the ruled promises list |

## 16e · `/pricing` (75) — only while monetisation is on (`App.jsx:1078`)

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | Three plans Basic (Included) · Plus (Request) · Pro (Request), badge, recommended, features ✓, CTA → `/login` | | :6-58, 60-72 | three **Tickets** side by side (perforated plans — a ticket you take), the recommended one clay-tint; features as ✓ rows |
| ☐ | Lever off → `NotFoundPage` | | App.jsx:1078 | Off the map (`errors.md`) |

## 16f · `/about` (32) · 16g `/contact` (57) · 16h `/faq` (40)

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | About: *Built for job seekers…* + Sign up / *What each tool is for*; three notes (The Problem · What We Built · Our Approach) | | AboutPage.jsx:8-30 | header + three sections with legs 01–03 (drawing: **drawing needed** — *the atlas's title page*) |
| ☐ | Contact: form (Name *, Email *, Subject select, Message *) → `POST /api/contact`; *sending* / *Message sent — We'll be in touch soon.* / *Something went wrong — please try again.* | | ContactPage.jsx:10-55 | a **Send ticket** (the composer pattern from `network.md`) with the same fields; sent → a Stamp *SENT*; error → `ErrorLine` |
| ☐ | FAQ: *Ask us something else* → `/contact`; four groups (Your data · Applying · The jobs · The extension) of Q&As | | FAQPage.jsx:18-38 | a **Gazetteer**-style index of questions (Q · GROUP), each expanding in place (`aria-expanded`) |

## 16i · `/privacy` (1222) · 16j `/terms` (88) · 16k `/docs/claude` (128)

Long legal / reference text: **plain plate styling, no metaphor** (D197 #17's rule for settings applies — the metaphor
doesn't help here). Body in Inter Tight at the reading measure; headings serif; a **contents rail** (TrailRail) on wide
screens.

| ☐ | Element | file:line | Proposed home |
| --- | --- | --- | --- |
| ☐ | Privacy: Overview · Information We Collect · How We Use Your Data · Data Storage and Security · Third-Party Services · The Free Tools · Your Rights · Cookies · Children's Privacy · Changes to This Policy; contact mailto; footer nav (Home · Terms · Contact) | PrivacyPage.jsx:164-1222 (sections :189-1146, footer :1160-1220) | the text verbatim (it is legal), plate type; the page's own footer nav → the public footer |
| ☐ | Terms: ten sections (Acceptance … Limitation of Liability …) | TermsPage.jsx:13-88 | the same |
| ☐ | Connector docs: Set it up · What each tool reads and writes · The checks · What is stored · The daily limit · AI-assisted applications · Troubleshooting · Disconnect · Reporting a security issue (security.txt) · Contact (three mailtos) | ConnectorDocsPage.jsx:36-125 | the same; code / config as a **CodePlate** |

## 16l–16o · The tools: `/tools/ats` · `/tools/generate` · `/tools/apply` · `/tools/honesty`

All public, no account for ATS / honesty; each POSTs a multipart form to `/api/standalone/<tool>`; each ends with a
sign-in / sign-up prompt (`loginHref()` / `/register`). `/resume` and `/ats-score` are legacy aliases into them, the query
(`?jd=`) carried (`App.jsx:1067-1068`).

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | ATS: PDF upload, job title, JD textarea (prefilled from `?jd=`), *Score*; *Upload a PDF and paste a job description.*; result = the shared `AtsReport` + band; *Tailor it* → `/tools/generate`; sign-in prompt | | ATSToolPage.jsx:40-190 | the **FitCard**'s back face (D202 — *the field card ⇄ the ATS card, one card*) with no résumé claims (public); inputs as a **QuestionTicket**-style form; the result's band as a Stamp |
| ☐ | Generate: PDF + JD → `/api/standalone/generate`; preview iframe, *Download HTML*, *Print*; sign-in prompt (quota) | | GenerateToolPage.jsx:30-190 | inputs as above; the preview in a **pl-card** "document plate" (paper-white page); Download / Print as paper buttons |
| ☐ | Apply: sign-in gate first, PDF + profile fields + JD → `/api/standalone/apply`; result | | ApplyToolPage.jsx:30-203 | the same form pattern; ⚠ owner: is `/tools/apply` still a public tool (it requires sign-in)? |
| ☐ | Honesty (D141): résumé file-or-text, original file-or-text (recommended), JD (optional) → `/api/standalone/honesty`; *N lines you may not be able to defend · N high risk*, unsupported skills, years / seniority claims, keywords in / added without support, *Only the lines that need attention* toggle, per-line fixes with *learn <term>* links; *Sign up to save and fix* | | HonestyToolPage.jsx:40-188 | a **Register**-style list (each résumé line a row; flagged = dashed + struck with one plain sentence why — the plate's *wrong answer* look); the toggle as a FilterChip |

## 16p · `/audit` (`pages/audit/AuditPage.jsx`, 182) — D150 T05–T08

Public, under `NavBar`; signed in keeps the result at once. APIs: `GET /api/audit/roles`, `GET /api/audit/role/:slug?level=`,
`POST /api/audit/start`, `POST /api/audit/:token/answer`, `GET /api/audit/:token/result`, `POST /api/audit/:token/claim`.
Server adds og tags for `?role=` (`server.js:17755-17771`); each role's page is in `/sitemap.xml` (`:11345`).

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | Start: *Do you clear the bar?*, role + level pickers, the role's card, **Start the audit** | | :21-37, 155-176 | **the 3-minute audit = a run across Gazetteer entries** (D203 (3)) — a Cartouche *"the bar for a mid backend engineer"*, Start = clay |
| ☐ | A question: the stem as h1, choices, the why after answering, *Continue ↵* / *See where you stand* | | :125-145 | **QuestionTicket** + the **Register** feedback (right = green LIT — proof, allowed; wrong = dashed + struck + why) |
| ☐ | Result: *N of M*, *What closes the distance*, Keep this result (signed in → kept: destination + checked skills, link to Your survey), Share, *Try another role* | | :88-120 | a **RouteLine** of the skills (lit = right), the gaps as onward tickets to their Atlas places; Keep = clay |

## 16q · `/survey` (58) · `/products` (38) · `/blog` (37)

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | `/survey` (D130): own header (logo → `/`), `GET /api/survey/form`, `SurveyForm` → `POST /api/survey`; *Thanks!*; *The survey did not load*; privacy footer line | | SurveyPublicPage.jsx:14-58 | the plate public nav; the form as a run of **QuestionTickets** (one at a time); Thanks = a Stamp |
| ☐ | `/products`: *Products* + one line + *🚧 This page is coming soon.* | | ProductsPage.jsx:1-38 | ⚠ **owner: strike it** (a nav link to a "coming soon" page; the emoji breaks the plate rule) — or fold into `/features` |
| ☐ | `/blog`: the same "coming soon" | | BlogPage.jsx:1-37 | ⚠ **owner: strike or keep** — if kept, the Library's *field notes* drawer is the natural home (posts as field notes) |

---

## 17′ · In-app Plans (`/app/plans`, `panels/PlansPanel.jsx`, 98) — proposed into **#17 Settings**

Only while monetisation is on (`App.jsx:592-599, 834`). APIs: `GET /api/plans`, `POST /api/plans/request-upgrade {requestedTier}`.

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | *Plans* + *Current plan: X. Your plan sets which tools you can use.* | | :52-62 | Settings → *Your plan*, one-line header |
| ☐ | A card per tier (current + change options): name, copy, *Active*, *Request upgrade / downgrade*, *Request pending* | | :64-92 | three plan **Tickets** (as `/pricing`), the current one stamped *ACTIVE*, *REQUEST PENDING* as a StatusTag |
| ☐ | Updates the user's plan / modes after load | | :24-31 | unchanged |
| ☐ | Status line (*Plan change request sent.* / error) | | :93 | `aria-live` line |

## 21′ · In-app Recruiter (`/app/recruiter`, `panels/RecruiterPanel.jsx`, 196) — proposed into **#21 Admin**, or struck

Route-only (no dock item — D5: no recruiter role exists; `App.jsx:578-596, 839`). Deep-linked `?company=`. APIs:
`GET /api/company/:name`, `POST /api/company/:name/consistency-check`.

| ☐ | Element | What it does today | file:line | Proposed home |
| --- | --- | --- | --- | --- |
| ☐ | *Recruiter* + the scope line (companies and roles only, no dossiers) | | :156-164 | ⚠ owner: keep or strike; if kept, Admin (tokens only, D197 #21) |
| ☐ | Company input + Load (Enter) | | :165-183 | the same, plate input |
| ☐ | KB reference card: stack, org units, hiring signal, LCA (shared `CompanyKbSections`); loading / error / *Not enough data on X yet.* | | :18-55 | the survey sheet's sections already show all of this publicly (Wave 1 #4) — **proposed: strike the card, link the survey sheet** |
| ☐ | Candidate-claim consistency check: paste résumé text → Consistent / Flagged inconsistency / No claim to check + findings; nothing stored | | :57-137 | Admin tool, plate tokens |
| ☐ | Empty *Enter a company to load its KB reference…* | | :184-188 | the drawer |

---

## Rows whose home is unclear (all PROPOSED — owner to place)

The whole of this file (no Wave 2 row) · the landing's hero plate (Atlas's volume plate vs the market's political map) ·
the shelf (kept as books vs region plates) · `/products` and `/blog` ("coming soon" pages — strike?) · `/tools/apply`
(public tool that needs sign-in) · Recruiter (strike vs Admin) · Plans (Settings) · whether `/survey` stays public.

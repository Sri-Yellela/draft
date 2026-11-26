# D197 Wave 2 · #15 — ONBOARDING → *Setting out* · M1 inventory + M2 brief + M3 mock

Status: M1–M3 done (47j, lane w2-person) · ⏸ awaiting the owner's M4 look

Read from the code on 2026-11-26 (47j, lane *w2-person*, from local `main` `a393442e`). Paths under `client/src/`.
**Nothing live changed.** The mock is `pages/dev/platePages/Onboarding.jsx`, at `/dev/plate?page=onboarding` (`&w=390`).

**What onboarding is today (D186 + A104 + D112 e2):** there is no onboarding *route*. A new account lands on the market;
with no job profile the deck's empty state is *Start with your résumé* with the one upload (`StartFromResume`). One résumé
makes the first job profile (field, level, titles, keywords), its base résumé, the profile's sections and empty contact
fields (D186-3 / A104); the person then answers only **the four things a résumé can't tell us** (D186-2) on Your profile;
a job profile made from a résumé carries a **Refine your job profile** prompt (D112 e2) that opens the five-step wizard
pre-filled. The wizard (`DomainProfileWizard`) is still the manual path (*Set it up by hand instead*, Job profiles' *+ New*,
the board's search when a query belongs to another family). Sign-in / sign-up is #17 (`settings.md` §6).

---

## M1 · what onboarding has today

### 1 · The first screen — *Start with your résumé* (`panels/DeckView.jsx:1372-1396` + `components/StartFromResume.jsx`)

| # | Element (file:line) | What it does today · API | Home in *Setting out* (M2) |
| --- | --- | --- | --- |
| O1 | The deck's empty card for `reason = "no_profile"`: *Start with your résumé.* / *Upload it and draft reads the roles you want and the skills you have, then picks your first jobs straight away.* (`DeckView.jsx:1373-1375`) | the new account's first screen | **Setting out's leg 01**, the page's one plain line + that sentence; the market shows a *Setting out* ticket in its place until a job profile exists |
| O2 | **Upload your résumé** (PDF, Word, txt) + drag-and-drop with the dashed outline (`StartFromResume.jsx:35-43`) → `parseResumeFile` → `POST /api/domain-profiles/from-resume` | one drop → the first job profile | **`SettingOutDrop`** (new, `plate/Person.jsx`): a dashed 1.5 px plate (*not yet*), the clay *Upload your résumé* button, drop anywhere on it — the page's one clay point |
| O3 | Hint *PDF or Word — or drop it here. draft reads your field, level, titles and skills from it and sets up your first job profile.* (`:44-46`) | | `SettingOutDrop`'s line |
| O4 | Status *Reading <file>…* → *Set up as <profile> · <level> · <titles>. You can refine it any time.* or the error (`:21-30`, `:47`) | `aria-live` status | `SettingOutDrop`'s status line (`role="status"`); on success the page moves to leg 02 |
| O5 | *Or take the 3-minute audit first* → `/audit` (`:49`, D150 T08) | either order leads to the map | a plain `Ticket` beside the drop: *THE AUDIT · 3 MINUTES · Or start with the audit* |
| O6 | *Set it up by hand instead* → `/app/job-profiles` (the wizard) (`:50-55`, `DeckView.jsx:1396`) | manual always available (D186) | a quiet link under the drop → leg 02's **By hand** route (the wizard, §3) |
| O7 | After upload: `fetchDeck()` + `setActiveProfileId` (`DeckView.jsx:1396`) | the deck is dealt | unchanged; the last leg's ticket *See your first picks →* opens the market |
| O8 | The other first-run empties: *no_resume* (*Add your résumé to get today's picks*, links Add your résumé → / Every job), *no_jobs*, *empty* (`DeckView.jsx:1376-1388`) | | stay on the market (D197 #2's states) — listed so nothing is lost; *no_resume* links to Setting out's leg 01 |

### 2 · What the résumé can't tell us — *the four things* (`pages/profile/ResumeSetup.jsx:9-45`, shown on Your profile `YourProfile.jsx:627`)

| # | Element | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| O9 | Heading *N things your résumé can't tell us* / *One thing …* + lead *Everything else came from your résumé. These stay unset until you answer — skip any of them.* | hidden when nothing is left | **leg 03** title + lead |
| O10 | Each item: label + *why*, a choice select (server-given choices) / Yes–No (willing to relocate) / text / date (start date) / salary placeholder (`:26-36`) | never inferred | **one `QuestionTicket` at a time** (kind `choice` / `text`; the start date a date field), the progress squares across the top = the items left |
| O11 | **Save** per item → `PUT /api/profile/four-things { key, value }` | | the ticket's *Next* (same API) |
| O12 | **Skip** per item → `PUT … { key, skip: true }` | each skippable | the ticket's foot *Skip this one* |
| O13 | Error line (`:42`) | | under the ticket, `role="alert"` |
| O14 | The same card stays on Your profile until every item is set or skipped (`YourProfile.jsx:627`) | | unchanged — the passport shows it as its clay waypoint (`profile.md` A22) |

### 3 · The manual path — the five-step wizard (`components/DomainProfileWizard.jsx`, 750 lines)

| # | Element (file:line) | What it does today · API | Home (M2) |
| --- | --- | --- | --- |
| O15 | Modal: blocking (no ✕) or dismissible (✕, `onDismiss`) (`:3-8`, `:345`); optional `bannerText` (`:9`) | | a plate sheet over the page (an 8 px-shadow plate, the *menu drop*), ✕ kept when dismissible |
| O16 | **Step indicator** Domain · Level · Titles · Keywords · Save (`STEPS :22`, `StepIndicator :81`) | | **`RouteLine`** (existing): five stops, lit = done, next = clay, ahead = dashed |
| O17 | Step 1 **Domain** — the domain list (`GET /api/domain-profiles/metadata`, retry *Try again*), *Other* (request a role: title, family, work preference, notes → `POST /api/domain-profiles/requests`) (`:367-421`) | | stop 1: `FilterChips` per domain (one pressed), *Other* opens `LabelledField`s |
| O18 | Step 2 **Level** — `PROFILE_SENIORITY` options with sub-lines (`:423-455`) | | stop 2: `FilterChips` |
| O19 | Step 3 **Titles** — suggested title chips (`GET /api/domain-profiles/metadata/:domain`), *Add a custom title…* (`:457-520`) | | stop 3: chips + `LabelledField` add |
| O20 | Step 4 **Keywords · Tools & Technologies · Action Verbs** chips + add, *Load more AI suggestions* (`POST /api/domain-profiles/generate-chips`) (`:522-624`) | | stop 4: three chip groups; the button keeps its job (see the unclear list) |
| O21 | Step 5 **Save** — profile name, the summary (Domain, Requested role, Seniority, Titles, Keywords selected), *Create Profile* / *Save Profile* (`:626-692`, `:714-745`) → `POST /api/domain-profiles` / `PUT /api/domain-profiles/:id` | | stop 5: a `FactSheet` of the choices + the ink *Create profile* button |
| O22 | *Back* (disabled on step 1), *n of 5*, *Next* (disabled until the step is answered, `canNext :276-282`) (`:696-745`) | | the sheet's foot, plate buttons |
| O23 | Edit / **refine** mode (pre-filled, `PUT { refined: true }`) (`:9-11`) | D112 e2 | the same sheet, banner *Read from your résumé — change anything that is not right. Every step is optional.* |
| O24 | Where it opens: Job profiles *+ New* / Edit (`panels/JobProfilesPanel.jsx:335`), Profile → résumés (`ProfilePanel.jsx:1579`), the board's search for another family (`panels/JobsPanel.jsx:4096`, `profileWizardIntent`), the poll's *needsProfileSetup* (`JobsPanel.jsx:3200`) | | each opener unchanged; they open the plate sheet |

### 4 · *Refine your job profile* (`components/RefineJobProfile.jsx`)

| # | Element | What it does today | Home (M2) |
| --- | --- | --- | --- |
| O25 | The prompt *<profile> was set up from your résumé. Check the field, level, titles and keywords it read — everything is already filled in.* + **Refine your job profile** (`:22-32`), on Job profiles and Profile → résumés | until saved once (`needs_refine`) | **leg 02 · Your bearing**'s ticket *Check what it read →* (opens the refine sheet); the prompt stays on Job profiles / the passport's sealed pages |

---

## M2 · the brief

**Atlas name: *Setting out*** (D197 #15). The first page of the journey: you hand over a résumé, draft takes your
**bearing**, draws your **first job profile on a plate**, then asks the **four things** it can't read. Parts:

| Leg | Name | Is |
| --- | --- | --- |
| 01 | **Hand over your résumé** | the drop (O1–O6) |
| 02 | **Your bearing** | what was read, as the market's cartouche sentence (*discovering frontend software engineering roles at mid levels …*) + the market plate with *you are here* — tap a dashed word to change it (the wizard's step behind it) |
| 03 | **Four things only you know** | the four things, one at a time (O9–O13) |
| — | **By hand** | the five-stop route (the wizard, O15–O24), always one press away |

- **Palette — Region IV** (navy, the market's): Setting out ends on the market, and no sector is known before the résumé.
  Once leg 02 places the person, the plate wears their sector's nearest region (as the market does).
- **The one clay point:** leg 01 *Upload your résumé*; after it, the next unanswered leg (02's *Looks right*, then 03's ticket).
- **Nav:** none of the area navs — a new person sees the dock and the `/d` tile; the market's area nav appears once leg 01 is
  done. (On phones: the top bar with the `/d` tile.)
- **Hero plate:** `MarketSurveyPlate` (existing) — the market as territories, empty until the résumé places *you are here*;
  then the beacon lands on the sector read. Title (a destination, 82 px serif): *Setting out.* · kicker *A NEW ACCOUNT · ONE
  RÉSUMÉ SETS UP EVERYTHING* · stats strip after the read *FIELD · LEVEL · TITLES · OPENINGS THAT FIT* (each cell opens its
  wizard step).
- **Sections, each one drawing:** 01 — drawing needed (*a résumé handed across a counter, a clay ticket stamped "read"*);
  02 — `MarketSurveyPlate` (the hero, the same plate: one drawing, the hero's); 03 — `CompassDial` (*n of 4 answered*);
  By hand — `RouteLine` (the five stops — a model, not art; drawing needed if the owner wants one).
- **The one operable model:** **the bearing sentence** (`Cartouche`, existing): every read value is a dashed word; tapping
  it opens its wizard stop pre-filled; the caption says what changed (`aria-live`).
- **Squares:** none (setting out proves nothing yet); the four things show as progress squares on the question ticket.
- **Onward tickets:** *See your first picks →* (the market) · *Your passport →* (`/app/profile`) · *Take the 3-minute audit →*
  (`/audit`).
- **Every M1 row's home:** the right-hand column above.

## M3 · the mock

`pages/dev/platePages/Onboarding.jsx` (`OnboardingMock`): the three legs as a step-through (*Show: before · after the
read*), the drop (`SettingOutDrop`, new), the cartouche bearing on the market plate, one four-things `QuestionTicket`, and the
*By hand* `RouteLine` with stop 2's chips — synthetic person, at 1280 and 390.

## Unclear homes (for the owner)

- **O20 *Load more AI suggestions*** calls `POST /api/domain-profiles/generate-chips` — check it against D190 (*nothing in
  draft's own data calls a model*); if it is a model call, the wizard's stop 4 should drop or relabel it.
- **O8 the market's other first-run empties** stay on the market (D197 #2) — confirm Setting out doesn't take them.
- **O24 the board's "profile for another family" opener** (`profileWizardIntent`) belonged to the classic board search;
  confirm the plate market still offers it (R2 retired the classic market's arms).
- **Leg order** — D197 says *upload → bearing → 4 things*; today the four things sit on Your profile, not in a flow. The mock
  puts them in the flow AND keeps them on the passport.

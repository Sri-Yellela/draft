# D166 T1 · The screens the redesign hasn't reached — inventory

Measured 2026-11-07 (45i) in a real Chrome against a local draft on a throwaway copy of the database, as a synthetic
signed-in account, at 1280 × 800 (`scripts/d166InventoryShots.mjs`, `scripts/d166OverlayShots.mjs`). Screenshots are in
`docs/legacy-shots/` (`<route>-1280.png`); the raw readings are `docs/legacy-shots/inventory-1280.json` and
`overlays-1280.json`.

**Current pattern** means Dusk, D145's type and rules, opened in place, no internal terms, no label chips.
**Legacy** means at least one of these: a content modal over a dimmed or blurred page, an internal word (*No signal*,
*HELD ON PURPOSE*, *Open & fill*, a reason code), a raw URL, or a label chip.

**Rank** means how often a person sees it: 1 is every visit (Home and its overlays), 2 is every application (the
tracker), 3 is regular use (Atlas, Profile, Interview), 4 is occasional (settings pages, job profiles), 5 is rare
(public pages a signed-in person seldom opens), and A is admin only.

`test/d166InventoryComplete.test.js` fails when a route in `client/src/App.jsx`, a panel in `client/src/panels/`, or a
full-screen fixed overlay in the client is missing from this file.

## ⭐ 46y refresh (2026-11-20) — re-marked against today's code

Re-read from the code at `b9bc6c70` (every L row's component and its mount point grepped; the guard's overlay scan re-run:
`CompanyViewModal` · `CoverLetterModal` · `DomainProfileWizard` · `PanelShell` · `ScrollDock` · `adminKit` · `AdminPanel` ·
`adminPeople` · `AutoApplyPanel` · `DatabasePanel` · `JobsPanel` — the same eleven as 11-07, nothing new). Not re-shot.
**None of L1–L10 has been rebuilt since 11-07, and no T2 sketch for any of them is logged** — every one still needs a sketch.

| # | Still mounted? (where, today) | Still legacy? | Needs a sketch |
|---|---|---|---|
| L1 | ✅ `AutoApplyPanel` → Home's timeline foot *Review all n →* (`openEverything`) and a held row's scoped review (`openScoped`) | ⛔ yes — the `Z.MODAL_SCRIM` modal; inside it *Open & fill*, *Show n attempts*, the run's raw status word (`completed` / `running` / `queued`), *Apply Run #id — semi* (the held view's own words were cleaned by D165 (5) in `lib/heldApplication.js`, the modal's were not) | ✅ yes (rank 2) |
| L2 | ✅ `JobBubble` (the board's bubbles, a bubble's company logo) and `JobCard` (only inside the full sheet, L7) | ⛔ yes | ✅ yes (rank 1) — or retire it for the company's own page (`/companies/:slug`, D179 P4b), which exists now |
| L3 | ✅ `JobDetailPanel` (the posting beside the deck) → Cover letter | ⛔ yes | ✅ yes (rank 1) |
| L4 | ✅ `JobsPanel` *Resume Enhance modal* | ⛔ yes | ✅ yes (rank 1) |
| L5 | ✅ `JobsPanel` `CompanyReuseModal` | ⛔ yes | ✅ yes (rank 1) |
| L6 | ✅ `JobsPanel` `SearchIntentDialog` | ⛔ yes | ✅ yes (rank 1) |
| L7 | ✅ `DatabasePanel` (Home → Settings → View → *The full sheet*); since 46y the Inbox is ALSO on Home itself (the same `ApplicationInbox`, restyled to `home-sketch.html`), so the sheet's Inbox tab draws the new list | ⚠ yes (its grid and row modal) | ✅ yes (rank 4) |
| L8 | ✅ `PanelShell` / `PanelScrim` (the board's filter drawer on a narrow screen) | ⚠ check — a drawer for controls (allowed, D148) | ❌ no, if T2 confirms it only holds controls |
| L9 | ✅ `DomainProfileWizard` (Job profiles, Profile, the board's job-profile controls, `RefineJobProfile`) | ⚠ yes (the older wizard look) | ✅ yes (rank 4) |
| L10 | ✅ `adminKit` / `AdminPanel` / `adminPeople` | ⚠ admin only | last |

**Not caught by the guard (CSS-only fixed layers, `position: fixed` in a stylesheet):** `ResumeChangesPanel.css`'s `.rc__scrim`
(What we changed over a full-screen scrim at z 9000 — 46j docked it beside the tailored résumé on a wide screen; on a narrow
one it is still a content layer over a scrim → ⚠ **L11, check in T2**) · `AppNav.css`'s `.appnav-scrim` + its 300 px drawer
(the Menu — navigation, allowed) · the assistant's floating panel (`AppNav.css`, bottom right — current, D191 / 46n) ·
`AtlasTerm.css` / `SkillMap.css` tooltips and `LearnCircle.css`'s toast (not content modals).

**Names that moved since 11-07 (the current-pattern rows below are corrected in place):** the jobs page is **/draft** at
`/app/jobs` (`/app` and `/app/today` land there, A215) — "Home" in the 11-07 rows meant it; **Home** is the tracker
(`/app/auto-apply`, A134 / O99 (a)), since 46y with the auto-apply bar, the Needs-you cards and the Inbox as its second
part (`home-sketch.html`); Ask draft became **Tiny** (46n) and then the **/d** assistant (46v); Atlas was rebuilt by A228
(46r); D180's **Network** place (`/app/network`) and 46f's **Feed** (`/app/feed`) and **Messages** (`/app/messages`) pages
are new (current pattern, D167's PlaceNav).

## Legacy, by rank (T2 works down this list)

| # | Surface | Opened from | Rank | Status | What's wrong | Shot |
|---|---|---|---|---|---|---|
| L1 | **The runs-review modal** (`panels/AutoApplyPanel.jsx`, *Apply Runs Review Modal*) | Tracker timeline → *Review all n →* | 2 | ⛔ legacy | A full-screen modal over a 55% scrim; each application card reads **HELD ON PURPOSE**, **No signal**, *The posting ↗*, *Open*, *Show 1 attempt*; "Blocks:OpenAI" has no space; **the floating nav dock is drawn over the modal's title**; the link says *Review all 4* when 1 application is in it. The held view (D165 (5)) already shows one application in place, so this is the remaining duplicate. | `tracker-review-all-1280.png` |
| L2 | **The company view** (`components/CompanyViewModal.jsx`) | Home → a bubble's company logo; the job card's company name | 1 | ⛔ legacy (from code) | A full-screen `C.SCRIM` modal (z 9000) for content: the company's page over Home. It should open in place in the posting. Not shot, because a brand-new account has no bubbles on Home (needs a seeded board). | — |
| L3 | **The cover-letter modal** (`components/CoverLetterModal.jsx`) | The posting (`JobDetailPanel`) → Cover letter | 1 | ⛔ legacy (from code) | A full-screen `C.SCRIM` modal (z 9000) for content. Not shot (the same reason as L2). | — |
| L4 | **The résumé-enhance modal** (`panels/JobsPanel.jsx`, *Resume Enhance modal*) | Home → the toolbar's résumé upload → Enhance | 1 | ⛔ legacy (from code) | A full-screen `Z.MODAL_SCRIM` takeover for content. Not shot (needs an uploaded résumé and a model call). | — |
| L5 | **The company-reuse modal** (`panels/JobsPanel.jsx` `CompanyReuseModal`) | Home → Draft on a second posting at a company already drafted | 1 | ⛔ legacy (from code) | A full-screen overlay (z 1000) asking a question that could be asked inline on the posting. Not shot (needs a prior Draft). | — |
| L6 | **The search-intent dialog** (`panels/JobsPanel.jsx` `SearchIntentDialog`) | Home → a board search that reads as an intent | 1 | ⛔ legacy (from code) | A full-screen `C.SCRIM` overlay (z 750) for a yes / no that could sit under the search bar. | — |
| L7 | **The full sheet** (`panels/DatabasePanel.jsx`, embedded) | Tracker → Settings → View → *The full sheet* | 4 | ⚠ legacy look | The Table's old grid (D15 / D54 / D55), kept on purpose behind Settings; its own row modal (`Z.MODAL_SCRIM`) is a content modal. | — |
| L8 | **The board's filter drawer** (`panels/JobsPanel.jsx`, `PanelScrim`) | Home → the sentence's words / sort on a narrow screen | 1 | ⚠ check in T2 | A drawer over a scrim. Drawers for controls are allowed (D148); listed so T2 confirms it isn't used for content. | — |
| L9 | **The job-profile wizard** (`components/DomainProfileWizard.jsx`) | Job profiles → New; Profile; Home's job-profile controls | 4 | ⚠ check in T2 | A fixed full-screen step flow; the older wizard look (not D145 type). | — |
| L10 | **Admin dialogs** (`panels/adminKit.jsx` confirm, `AdminPanel.jsx` delete-user preview, `adminPeople.jsx`) | Admin | A | ⚠ admin only | Full-screen scrims for confirmations. Allowed for a destructive confirm; restyle last. | — |

## Current pattern (no change needed)

The signed-in app is one route, `/app/*`; its tabs are the rows below.

| Surface | Route / opened from | Rank | Notes | Shot |
|---|---|---|---|---|
| /draft — the jobs page (today's draft, the deck, the board; "Home" until A134) | `/app/jobs` (`/app/today`, `/app` and `/` when signed in land here, A215) | 1 | D152 / D156; no markers, no horizontal scroll. | `app-today-1280.png` |
| The posting | Home → a bubble | 1 | D156 (1c): opens in place of the list. Not shot (no bubbles on a new account). | — |
| Home — the tracker (A134) | `/app/auto-apply` (`/app/database` redirects here) | 2 | D146 / D149; the held row opens in place (D165 (5), walked 45i); 46y: `home-sketch.html`'s auto-apply bar, Needs-you cards and the Inbox tab. | `app-auto-apply-1280.png` |
| The held application, opened | Tracker → a held row | 2 | D165 (5), walked against the sketch 45i. | `docs/d165-shots` (scratch) |
| Auto settings drawer | Tracker → Settings; Profile | 2 | D148: a drawer for controls. | `tracker-settings-drawer-1280.png` |
| The résumé editor | Posting → Résumé → Preview / edit | 1 | D157 (A): full-screen on purpose (an editor, not content over a page). | — |
| What we changed | Posting → Résumé → What we changed | 1 | `components/ResumeChangesPanel.jsx`, D90 P3. | — |
| Atlas | `/app/atlas` (`/atlas/*` redirects) | 3 | D167 groups; rebuilt by A228 (46r: the readout / route / map, the market tree and Compare roles retired). | `app-atlas-1280.png` |
| Profile + its sections | `/app/profile` (`/profile/*`); `/app/integrations` → `/app/profile/connections`; `/app/account` → `…/account`; `/app/saved-answers` → `…/answers`; `/app/customise` → `…/appearance` | 3–4 | D167. | `app-profile-1280.png` and the redirects' shots |
| Interview | `/app/interview` (`/interview/*`) | 3 | D167. | `app-interview-1280.png` |
| Job profiles | `/app/job-profiles` | 4 | Route-only (not in the bar). | `app-job-profiles-1280.png` |
| Recruiter | `/app/recruiter` | 5 | Route-only. | `app-recruiter-1280.png` |
| One application's page | `/app/job/:id` (`JobWorkspacePanel`) | 4 | Opened from the tracker's *Its own page*. Not shot (needs a sent application). | — |
| Plans | `/app/plans` (`PlansPanel`) | — | Only when monetisation is on (it is off; the route bounces to Home). | — |
| Sign in / Register | `/login`, `/register` | 1 (signed out) | AuthScreen. | `login-1280.png`, `register-1280.png` |
| The assistant (Ask draft → Tiny 46n → /d 46v) | the floating button, bottom right | 3 | D190 / D191 floating panel. | — |
| Network · Feed · Messages | `/app/network` · `/app/feed` · `/app/messages` | 3 | D180 P1 (45o) and 46f; PlaceNav. Not shot. | — |
| The inline sign-in popover | the public nav → Sign in | 5 | `components/InlineLoginPopover.jsx`. | — |

## Public pages (rank 5; checked for markers, none found)

`/features` · `/how-it-works` · `/extension` · `/about` · `/contact` · `/faq` · `/privacy` · `/terms` · `/survey` ·
`/docs/claude` (one URL shown as text, on purpose: the connector address to paste) · `/products` · `/blog` ·
`/tools/ats` (`/ats-score` redirects) · `/tools/generate` (`/resume` redirects) · `/tools/apply` · `/tools/honesty` ·
`/pricing` (a 404 page while monetisation is off, by design, and not linked) · `/try` (302 → `/` since the trial's
removal) · `*` (the 404 page). Each has its `<route>-1280.png`. These keep the marketing look (LandingPage styles),
not D145's app look. Whether to bring them in line is a T2 question for the owner, not a defect.

⭐ **Added 45o (routes from 45l–45n, never listed until the inventory guard ran):** `/jobs` (the open board; signed out it opens on the
browse board, A147) · `/jobs/:slug` (a posting's public page, server-rendered, D128) · `/companies/:slug` (a company's
page, D179 P4b; inside the shell at `/app/companies/<slug>`) · `/audit` (the 3-minute audit, D150) · `/draft/resume/:jobId`
(the résumé editor's own address, D157 (i)). All current pattern — no legacy markers.
⭐ **Added 45r (45q's A157, found by the inventory guard):** `/:companySlug` (a company's own address, e.g. `/stripe`; a slug
that is one of draft's own words lives at `/companies/<slug>`, shared/companyPaths.js) · `/:companySlug/:jobId` (a posting
under its company, the board id keeps two same-titled jobs apart; the old `/companies/<slug>` and `/jobs/<words>-<id>` answer
301). Both are the LAST routes before the app's fallback, so every route of draft's own wins.

## Admin (rank A; not shot, admin sign-in)

`/admin/login` · `/admin/set-password` · `/admin` (`AdminPanel` and its tabs: `adminAdmins` · `adminAppearance` ·
`adminAtlas` · `adminCalibrate` · `adminEmail` · `adminEnrichment` · `adminLearnCircle` · `adminLearnImport` ·
`adminOps` · `adminPeople` · `adminQuestions` · `adminReadiness` · `adminTesterDetails` · `adminTesters` · `adminUsage` · `adminReports` (D183 profile reports) · `adminCompanyRecords` (A142) · `adminNetwork` (D180 P1) · `adminRuns` ((A)-2) · `adminDiagnostics` (D151 Rule 6) · `adminPhase1` (D150 T16) · `adminGateway` (D162 G4, the model gateway's card under System → Usage) · `adminFlags` (A187 Stage 0, runtime flags under System → Usage);
shared `adminKit`, `adminMap`, `adminLearnSandbox`) · `/admin/db` (`DBInspector`). The admin look is its own; only
L10's dialogs are listed as legacy.

## Panels, for completeness

`AccountPanel` · `AutoApplyPanel` · `AutoApplyPanelSections` · `CustomisePanel` · `DatabasePanel` · `DeckView` ·
`IntegrationsPanel` · `JobProfilesPanel` · `JobWorkspacePanel` · `JobsPanel` · `PlansPanel` · `ProfilePanel` ·
`RecruiterPanel` · `SandboxPanel` · `SavedAnswersPanel` — each reached through a route or tab above (`SandboxPanel`
is the résumé sandbox, the A4 render inside the posting and the résumé editor; `DeckView` is Home's deck).

## Full-screen overlays found in the code

`CompanyViewModal` (L2) · `CoverLetterModal` (L3) · `PanelShell` / `PanelScrim` (L8) · `ScrollDock` (the public
pages' full-screen menu on an opaque background, not a content modal over a page) · `adminKit` (L10) · `AdminPanel`
(L10) · `adminPeople` (L10) · `AutoApplyPanel` (L1) · `DatabasePanel` (L7) · `JobsPanel` (L4, L5, L6, L8).

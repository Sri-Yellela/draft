# D197 Wave 2 · (not in D197's tables) — THE JOB WORKSPACE (`/app/job/<id>`) · M1 inventory + PROPOSED M2

Status: M1–M3 done (47j, lane w2-person) · ⏸ awaiting the owner's M4 look — **M1 + a proposed M2 only; no mock yet**
(the page is not in D197's Wave 2 table; the owner places it first)

Read from the code on 2026-11-26 (47j, lane *w2-person*, from local `main` `a393442e`). Paths under `client/src/`.
**Nothing live changed.** The 47j probe found this page missing from D197's tables: **one application's page** (D102 P5,
*the Draft House job page*) — `/app/job/<applicationId>` and `/app/job/for/<jobId>` (`App.jsx:535-537`, `:833` →
`panels/JobWorkspacePanel.jsx`, 359 lines), opened from Home (the ledger's register), The Table, Interview → *Coming up*'s
*Prepare* (`?tab=prep`), and a shared link. Title in the shell: *Application* (`App.jsx:456`).

---

## M1 · what the job workspace has today

### 1 · The page (`JobWorkspacePanel.jsx:44-203`)

| # | Element (file:line) | What it does today · API | Home (PROPOSED M2) |
| --- | --- | --- | --- |
| W1 | Load: `GET /api/pipeline/job/:applicationId` or `GET /api/pipeline/job-for/:jobId` (`:53-59`); *Loading…*; 404 → *This application is not yours, or it no longer exists.* + ← Back (`:74-75`) | one record, kept through retries / approval / sending | `plateState` skeleton; the 404 as an *Off the map* plate (D197 #22) with *Back to the ledger* |
| W2 | **← Back** (history, else `/app/auto-apply`) (`:72`, `:87`) | | the breadcrumb chain *THE LEDGER / <COMPANY> / <ROLE>* — the first crumb is the way back |
| W3 | Title (role), company · location · *updated <when>* (`:88-91`) | | the opening's ticket head (`Opening` from `plate/Tickets.jsx` — the posting as a perforated ticket), *updated* in the mono kicker |
| W4 | **Status** mark (*Needs you · Ready to approve · Submitted · Interview · Offer · Rejected · Failed*) (`:92`) | | a `StatusTag` (the word carries it) |
| W5 | **Prep countdown** *Interview / Assessment in 3 days* (warning ≤ 2 days) (`:93-94`, `countdownWords :36-42`) | D110 | a `Stamp` on the ticket (*INTERVIEW · IN 3 DAYS*) — clay when ≤ 2 days |
| W6 | **Open the posting ↗** (`:95`) | the employer's page | the ticket's action |
| W7 | The tabs **Checklist · Résumé · Form · Job · Emails** (+ **Prep** when D103 filed an interview / assessment); counts on Form (needs + open questions) and Emails (`:22`, `:97-108`) | | `BinderTabs` (existing), the counts as mono sub-labels |
| W8 | Lands on **Form** when the application needs you or is approvable (`:62`); on **Prep** with `?tab=prep` when Prep is on (`:64-68`) | land on what needs you | unchanged |
| W9 | **Checklist** — each step with its state word (done / current / waiting / skipped), *n of m* filled, *sent by Apply for me / you approved it*, the needs-you fields (`:110-122`) | | `RouteLine` (existing) — the run as stops (`LedgerRunRoute`'s idea, the ledger's *the run*: READ · TAILORED · ATTACHED · FILLED · YOU · SENT) |
| W10 | **Résumé** — *A tailored résumé was made for this application. ATS n (your base: m).*, **Open the résumé** (`artifactUrl`) / *No tailored résumé for this one — your base résumé is used.* (`:125-136`) | | a `FactSheet` (*RÉSUMÉ · TAILORED · ATS 80 · BASE 71*) + the button; the ATS number answers with the `FitCard` (D202) |
| W11 | **Form** — *Needs you · n* (open questions + unfilled fields) + *Answer these in Home — what you answer is saved for next time.* (`:139-149`) | | **the ledger's Needs-you `QuestionTicket`**, one at a time (`ledger.md` §3) — answered here, not sent to Home (see unclear) |
| W12 | Every filled value with its source on hover (*from your profile · a saved answer · from the posting · you answered it · your setting*) (`:150-163`) | | `FactSheet` *FILLED FOR YOU · 22 OF 24* — the source as a mono note under each value (not hover-only) |
| W13 | **Approve & send** + *These values go to the employer exactly as listed.* / the pending message (`:164-171`) → `decidePending([runJobId], true)` (D36·5: only a click sends) | | the page's ink button under the fact sheet; the one clay point while approvable |
| W14 | **Job** — the posting text with Atlas terms linked (`AtlasText`, `useAtlasTerms` read when the tab opens) (`:173-183`) | | the opening sheet's posting section (D199 C7's `OpeningSheetView` sections) |
| W15 | **Emails** — linked replies (subject, from, when, category, the text) / *No email linked to this application yet. Replies you forward to your draft inbox appear here.* (`:184-200`) | | a register of letters (D197 #14's *Correspondence* look) |

### 2 · Prep (`PrepTab`, `JobWorkspacePanel.jsx:205-336`; D110) → `GET /api/interview/prep/:applicationId`

| # | Element (file:line) | What it does today · API | Home (PROPOSED M2) |
| --- | --- | --- | --- |
| W16 | **The date** — stated (by you / an email), or *No date yet…*; date + time inputs, **Save the date**, **Clear** (yours only) (`:231-247`) → `PUT /api/interview/prep/:id/date` | the countdown starts | `LabelledField`s + button; the countdown stamp (W5) |
| W17 | **The posting's skills against your profile** — each skill *you have it / on your résumé, not your skills / missing*, its Atlas page link + free resources (`:249-267`) | | `Legend` (existing — the survey sheet's ■ yours / ⬚ not yet), each name linking to its Atlas place |
| W18 | **Likely rounds** (from the posting / emails) / *Neither the posting nor the emails name a round.* (`:269-277`) | | `RouteLine` of rounds |
| W19 | **Story bank** — *Start from my experience* (`POST /api/interview/stories/from-profile`), *Add a story*, each story *Edit* / *Delete*; the story form (title, situation, task, action, result, themes, *Only what you did — never a result you did not get.*) (`:279-299`, `StoryForm :338-357`) → `/api/interview/stories*` | | the Interview page's story bank (D197 #13 *Proving ground*) drawn here |
| W20 | **Debriefs** — *After a round*: round, held on, how it went, questions (one per line), notes, *Save the debrief* / *Cancel*; the list (`:301-334`) → `POST /api/interview/debriefs` | only you see it | as W19 (Proving ground's own pieces) |

## PROPOSED M2 — **atlas name: *The voyage*** · PROPOSED — not in D197; owner to place

One application followed end to end — a single **voyage** from the market's *opening* to the employer's reply. It is the
ledger's row opened to its own page (the ledger is the log of every voyage; this is one voyage's page).

- **Where it sits (proposed):** **under the ledger** (Home), as the register row's page — the breadcrumb *THE LEDGER /
  KESTREL PAYMENTS / FRONTEND ENGINEER II*; the opening sheet (`/app/jobs/<id>`) links to it once an application exists.
  **Owner to place.**
- **Palette:** the opening's sector region (as the opening sheet); clay = what needs you.
- **The one clay point:** the next thing only the person can do — the held question (W11), else *Approve & send* (W13),
  else the interview countdown (W5) when ≤ 2 days.
- **Hero:** the opening as its perforated ticket (`Opening`) beside **`LedgerRunRoute`** (existing — *one application as a
  route*), the status stamp, the countdown stamp; one plain line (a working page).
- **Sections (binder tabs), each one drawing:** Checklist — `LedgerRunRoute` (the hero's); Résumé — `SurveyMatchDial` /
  `CompassDial` (ATS against base); Form — drawing needed (*a form on a clipboard, the held lines dashed*); Job — the
  opening sheet's `TeamDiorama`; Emails — drawing needed (*letters in a post rack*); Prep — `PlaceElevationProfile`
  relabelled *the rounds as a climb* or drawing needed.
- **The one operable model:** **the held question, one at a time** (the ledger's `QuestionTicket`) — answering lights the
  route's *YOU* stop.
- **Squares:** none (a run's stops are its route, not proof).
- **Onward tickets:** *Prepare in Proving ground* (Interview) · *The company's survey sheet* · *Back to the ledger*.

## Unclear homes (for the owner)

- **The page itself** — under the ledger (proposed) or merged into the opening sheet (`/app/jobs/<id>`, D199 C7) as its
  *your application* section?
- **W11 the Form's held questions** say *Answer these in Home*; the proposal answers them here (the ledger's one-at-a-time
  ticket). Keep the hand-off, or answer in place?
- **W19 / W20 the story bank and debriefs** are Interview's (D197 #13); drawn here they would be the same component twice —
  the owner's call whether Prep links to Proving ground instead.

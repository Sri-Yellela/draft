# D197 Wave 2 · (not in D197's tables) — JOB PROFILES · M1 inventory + PROPOSED M2

Status: M1–M3 done (47j, lane w2-person) · ⏸ awaiting the owner's M4 look — **M1 + a proposed M2 only; no mock yet**
(the page is not in D197's Wave 2 table; the owner places it first)

Read from the code on 2026-11-26 (47j, lane *w2-person*, from local `main` `a393442e`). Paths under `client/src/`.
**Nothing live changed.** The 47j probe found this page missing from D197's tables: `/app/job-profiles`
(`App.jsx:596` a route-only tab, `:838` → `panels/JobProfilesPanel.jsx`, 472 lines), opened from Profile → *Manage*
(`ProfilePanel.jsx:1168`), Setting out's *Set it up by hand instead*, the deck's empty links, and D86's carried résumé.

---

## M1 · what Job profiles has today

| # | Element (file:line) | What it does today · API | Home (PROPOSED M2) |
| --- | --- | --- | --- |
| J1 | Header: label *Job Profiles*, title *Job profiles*, lead *Create, edit, delete, and switch profile-specific search targets. Each job profile keeps its own titles, skills, base resume, extracted signals, ATS basis, and search behavior.* (`:143-152`) | | one plain line *Your bearings* (D200 Rule 3) + a shorter lead; kicker *THE MARKET · JOB PROFILES* |
| J2 | **+ Add Profile** (`:154-156`) → the wizard (`DomainProfileWizard`, create) | | the header action → the plate sheet (`onboarding.md` O15–O22) |
| J3 | Status line (`:158-162`) | | `pl-notice` |
| J4 | **The carried résumé** (*<file> — the résumé you checked before signing up.*, the honesty-check flagged lines), *Dismiss* (`:164-184`, `lib/signupCarry.js`) | queue 30 / D141 | a clay-tint `Ticket` at the top (*FROM SIGN-UP · <file>*) — the page's one clay point while it exists |
| J5 | **Refine your job profile** prompt (`RefineJobProfile`, `:191`) | D112 e2 | a `Ticket` above the cards (*READ FROM YOUR RÉSUMÉ · Check what it read*) |
| J6 | One **tile per job profile** (`TileGrid` / `TileCard`, `:193-296`): name, meta *seniority \| resume linked / missing*, *Active* tile pill | | one **bearing card** per profile: the profile's `Cartouche` sentence (field · level · titles · location), the sector's region tag, *ACTIVE* as a plain mark (no pill — D60) |
| J7 | Base résumé state *Ready · <date>* / missing; **Upload** / **Replace** (PDF / Word) (`:206-232`) → `parseResumeFile`, `PUT /api/domain-profiles/:id/base-resume` (`:96`) | | the card's foot: the file line + the button |
| J8 | **Use <carried file>** on a profile with no résumé (`:224-231`) | the carry lands | the card's foot, clay while J4 is open |
| J9 | **Include a summary section** switch + its line (*Generated resumes for this profile open with a summary* / *Off…*) (`:247-270`) → `PUT /api/domain-profiles/:id { include_summary }` (`:120`) | AI1 | a switch row in the card |
| J10 | **Edit** (the wizard, edit mode), **Activate** (disabled when active) → `POST /api/domain-profiles/:id/activate`, **Delete** (disabled when it is the last one) → `DELETE /api/domain-profiles/:id` (`:276-292`, `:55`, `:68`) + `deleteProfileCache` | | the card's three buttons (Delete dashed, says *the last one can't be deleted* when disabled) |
| J11 | Read failed → *… could not be read* + **Try again** (`:300-312`, D156 (6)) / loading / *No job profiles yet. Add your first one and draft starts finding jobs that fit it.* (`:313-318`) | never "missing" on a failed read | `plateState` error / loading / empty drawer (same words, the empty drawer's action = *+ Add a profile*) |
| J12 | **Trackers** (`Trackers`, `:364-472`) — **Saved searches** per profile with the new count (*count unavailable*), **Open** → activates the profile, `/app/jobs?tracker=<id>` (`:376-381`) | D159 T2 | **02 · What you follow** — a `Gazetteer` (WHAT · KIND · NEW · ACTION) |
| J13 | **Companies you follow** — new count, **Open** (marks seen → `POST /api/trackers/companies/:id/seen`, `/companies/<slug>`), **Unfollow** (`POST /api/companies/:slug/follow { on:false }`) (`:382-390`, `:448-458`) | | rows in the same index; the company name answers (its survey sheet, D200 Rule 2) |
| J14 | **Tracked pages** — add a careers page / board URL (*https://jobs.lever.co/company or a careers page*, *Track*), each page's status (`PAGE_STATUS`), **Remove** (`:392-407`, `:420-432`, `:459-467`) → `POST /api/trackers/pages`, `DELETE /api/trackers/pages/:id` | | rows + a `LabelledField` add row |
| J15 | Trackers loading / error + *Try again* / *Nothing tracked yet.* (`:433-435`) → `GET /api/trackers` | | `plateState` |
| J16 | The wizard sheet (create / edit) (`:335-352`) | | `onboarding.md` §3 |

## PROPOSED M2 — **atlas name: *Your bearings*** · PROPOSED — not in D197; owner to place

A job profile is a **bearing** — the market's word for the sentence filter (the cartouche, D196 addendum): *discovering
frontend software engineering roles at mid levels in Boston, using React…*. This page is the drawer of every bearing you
keep, which one you are travelling on (*active*), and what you follow along the way.

- **Where it sits (proposed):** in **the market's area** (More → *Your bearings*), since a bearing is the market's control
  (D196: *the market has no pill, its location lives in the bearing*); the passport's sealed pages link here (*Manage*).
  **Owner to place** — the alternative is inside Your passport.
- **Palette:** Region IV (the market's); each bearing card wears its own sector's nearest region on its tag only.
- **The one clay point:** the carried résumé (J4) while it exists; else the active bearing's *Set out on this bearing →*
  (the market, filtered).
- **Hero:** none (a working page — D200 Rule 3): one plain line *Your bearings* + kicker + a `StatsStrip` *BEARINGS ·
  ACTIVE · SAVED SEARCHES · COMPANIES FOLLOWED · NEW SINCE YOUR LAST VISIT* (each cell answers).
- **Sections:** **01 · The bearings** (the cards, J6–J10) — drawing: `MarketBoardOrder` / `MarketTerrain` is the market's;
  this needs **drawing needed — *a compass rose with one needle per bearing, the active one inked*** (`CompassDial` is the
  nearest existing piece); **02 · What you follow** (J12–J15) — `SurveyHiringProfile` (existing: the company's postings by
  month, shown for the first followed company) or drawing needed.
- **The one operable model:** **Activate** — choosing a bearing redraws the cartouche at the top (`aria-live`: *Now
  travelling on Frontend · mid · Boston*).
- **Squares:** none. **Onward tickets:** *Set out on this bearing* (the market) · *Your passport* · *Add a bearing* (the
  wizard).

## Unclear homes (for the owner)

- **The page itself** — the market's area (proposed) or the passport's? D197 has no row for it.
- **J9 *Include a summary section*** is a tailoring rule; the passport's sealed pages also hold *How your résumés are
  tailored* (`profile.md` A43). One home or both?
- **J12–J15 Trackers** could live on the market (*Following*) rather than here.

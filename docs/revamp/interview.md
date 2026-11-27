Status: M1–M3 done (47j, lane w2-practice) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 #13 · Interview → **Proving ground** (`/app/interview/<panel>`)

The rows I1–I9 of `docs/revamp/atlas-interview-m1.md` are the summary of this page and keep their numbers; this file is the
full inventory under them (I1.1, I3.2 …) plus what that file did not list. D203's homes are approved and followed:
(9) company guides → the survey sheet's *Interviewing here*, linked from here; (10) Defend, Debrief and the story bank stay
here; the questions they produce tag Gazetteer entries. **No live page changes until Wave 1 (#8) has landed and the owner
has looked at the mock (M4).** Mock: `client/src/pages/dev/platePages/Interview.jsx` → `/dev/plate?page=interview`
(`&w=390`, `&panel=<view>`).

## M1 · Every control, view, state, link and behaviour today (read from the code, 47j)

Files: `client/src/pages/interview/InterviewPage.jsx` (344 lines), `interviewModel.js` (101), `InterviewPage.css`;
`components/PlaceNav.jsx` (the nav card); `App.jsx:547-552, 707, 837, 1125` (routing); API `routes/interview.js`.
The prep surface per application is the Job workspace's Prep tab (`panels/JobWorkspacePanel.jsx:205`, I1a) — it belongs to
the Job workspace page (`/app/job/<id>`), listed here only where Interview links to it.

### The place and its navigation

| # | Element | What it does today | file:line | API | Where it lives in Proving ground |
|---|---|---|---|---|---|
| I0.1 | The nav card (PlaceNav): eyebrow *Ready for the room*, title *Interview*, four groups (Coming up · Prepare · Practise · After), nine items | Each item is a link to its own address; the current one `aria-current="page"`; ↑ / ↓ / Home / End move focus (A136) | `InterviewPage.jsx:338-342`, `interviewModel.js:13-29`, `PlaceNav.jsx:29` | — | The shell's **area nav** (D196): the four groups become the four views *Coming up · Prepare · Practise · After*; the nine panels are sections inside them (M2 below). No pill (Interview has no panel to open). |
| I0.2 | The count on *Your interviews* (meta = upcoming rounds not yet past) | Shows how many interviews are ahead | `InterviewPage.jsx:298-300` | `GET /api/interview/upcoming` | The *Coming up* view's count, on the view link (the area nav's badge style) and the stats strip's first cell |
| I0.3 | Addresses: `/app/interview/<panel>` (9 ids); `/app/interview` + `#<panel>`; an unknown panel → `/app/interview/upcoming` (replace); `/interview/*` forwards into the app | Links, Back, reload and shared URLs land on the same panel | `interviewModel.js:11, 31-43`; `App.jsx:550, 707, 1125` | — | Kept: each old address opens its view **scrolled to its section** (`/app/interview/defend` → Practise · Defend). The view addresses are new: `/app/interview/{upcoming,prepare,practise,after}`; the nine old ids stay valid forever (D200 Rule 1). |
| I0.4 | Scroll to top on panel change | — | `InterviewPage.jsx:302` | — | Kept (view change); a section address scrolls to its section instead |
| I0.5 | The dock's *Interview* item (D167) | Opens `/app/interview` | `App.jsx:455`, `components/AppNav.jsx` | — | Unchanged (the shell, Wave 1 #1) |

### I1 · Coming up — *Your interviews* (`upcoming`)

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| I1.1 | Head: eyebrow *Coming up*, title = `upcomingHeadline()` (*No interviews yet* · *Nothing coming up right now* · *One interview to prepare for* · *N interviews to prepare for*), lead *Found in your Inbox and matched to your applications.* | Says how many are ahead | `InterviewPage.jsx:50-51`, `interviewModel.js:72-77` | `GET /api/interview/upcoming` | The page's one-line header (D200 Rule 3) on the Coming up view: the same headline words + a mono kicker (*PROVING GROUND · WEEK 48*) |
| I1.2 | Loading line *Loading…*; error line *Your interviews could not be loaded: …* | — | `:52-53` | — | `plateState` loading skeleton / error line + Try again (R1) |
| I1.3 | Empty card *No interview invites yet* + why + **Connect your mail** → `/app/profile/connections` | Explains where invites come from | `:54-61` | — | The empty drawer (dashed *NOT YET*) with the same sentence and the same link |
| I1.4 | One row per interview: company (bold) · title · kind (*Interview* / *Assessment*) · when (`whenWords`: Today / Tomorrow / In N days / N days ago) + date + time, or *no date yet — add it in Prepare* · the email subject in quotes | A list of rounds coming up | `:62-75`, `interviewModel.js:62-69` | same | **A perforated ticket per interview** (`Ticket`): kicker = kind · when · date; title = company; line = role + the subject; the soonest one is the page's **one clay point** (tone `clay-tint`) |
| I1.5 | Past rounds stay listed, marked `data-past` | — | `:65` | same | The ticket shows *N days ago* and moves under *Recent* in the same section (never hidden) |
| I1.6 | **Prepare** → `/app/job/<applicationId>?tab=prep` | Opens the application's Prep tab (I1a) | `:72` | — | The ticket's go-line *Prepare →* to the same address |
| I1a | The Prep tab (date + Save the date / Clear, skills vs yours with Atlas links, likely rounds, STAR stories with Start from my experience / Add / Edit / Delete, debriefs with *After a round*) | Prep for one interview | `panels/JobWorkspacePanel.jsx:205-340` | `GET /api/interview/prep/:id`, `PUT …/date`, stories, debriefs | **Stays in the Job workspace** (its own Wave 2 row); the Prepare ticket links to it. Skill rows → Gazetteer entries (D201). |
| I1b | The connector pack (`draft_get_interview_prep`) — no screen | Your own Claude gets the posting, your experience and past questions | `routes/interview.js:54`, `services/byom/tools.js:128` | `GET /api/interview/prep/:id/connector-data` | Unchanged; Practise → Mock interview keeps its *Set it up* link (I4) |

### I2 · Company guides (`guides`) — D203 (9)

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| I2.1 | Head *Guides are coming* + lead (stages, what people were asked, sources) | Placeholder | `:83-84` | — | **The survey sheet's *Interviewing here* section** (D203 (9)); here, Prepare carries an onward ticket *How Kestrel interviews → the survey sheet* per upcoming company |
| I2.2 | Note card *Built from shared debriefs, with sources* + **Your interviews** button | Points back to Coming up | `:86-89` | — | The ticket's sub-line says *being written from shared debriefs* until D150 T12–T13 lands (after counsel) |

### I3 · Tracks by round + the story bank (`tracks`) — D203 (10): stays

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| I3.1 | Head *Each kind of round* + lead | — | `:107-108` | — | Prepare view, section 01 *The rounds* |
| I3.2 | Five round tiles (Recruiter screen · Coding · System design · Behavioural · AI-enabled coding), each: *N questions from your debriefs* / *No questions yet — add them in a debrief* / *No question bank for this round yet*; behavioural adds *· N stories in your bank* | Your own bank per round | `:109-121`, `interviewModel.js:46-59` | `GET /api/interview/questions`, `GET /api/interview/stories` | **The rounds as a route** (`RouteLine`: a stop per round; a round with questions is *lit* only when proven — here the stops show *underway* / *ahead*, never lit for counts) + a gazetteer under it with the counts word for word |
| I3.3 | Quiet line *Practice tracks for each round are coming; what is listed here is your own.* | — | `:122` | — | Kept as the section's small print |
| I3.4 | **Your story bank**: empty → explanation + **Start from my experience** (POST, then reload + *N stories started from your experience.*); else the first 12 story titles; error line; status message | Seed and list STAR stories | `:123-137`, `:100-104` | `POST /api/interview/stories/from-profile`, `GET /api/interview/stories` | Prepare view, section 02 *Your story bank*: a gazetteer of stories (title · themes) + the same button and message; the empty drawer keeps the sentence |

### I4–I6 · Mock interview, Ask the coach, Drills

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| I4.1 | Mock: *Talk it through, like the real thing* · *draft's own mock interview, with voice, is coming.* · the connector paragraph · **Set it up** → `/app/profile/connections` · **How it works** → `/docs/claude` | Placeholder + the BYOM path | `:308-314` | — | Practise view, section *Mock interview*: a dashed *not yet* drawer with both links (D161 not built) |
| I5.1 | Coach: *Ask a question, hear a strong answer* · *Coming — not built yet.* · the rule (answers from your résumé, labelled as an example) | Placeholder | `:316-320` | — | Practise view, *Ask the coach* drawer with the same rule (D161) |
| I6.1 | Drills: lead (timed, extended time, untimed) · **Start a check** → `/app/atlas/check` · the patterns paragraph · **Coding interview patterns** → `/app/atlas/library/coding-interview-patterns` | Two links into Atlas | `:321-328` | — | Practise view, *Drills*: two onward tickets. Under D201 the check = entry practice and the patterns course = a route of Gazetteer entries; the tickets follow those addresses when they move (Wave 1 #8 / the Gazetteer) |

### I7 · Defend your résumé (`defend`) — D203 (10): stays; the page's one operable model

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| I7.1 | Head *Every line you wrote, asked about* + lead | — | `:173-174` | `GET /api/interview/defend` (no-store) | Practise view, section 01 *Defend your résumé* (leg header) |
| I7.2 | States: *Reading your résumé…* · error *Your résumé could not be read: …* · no résumé (card + **Open your Profile** → `/app/profile`) · no bullets (card: bullets start with •, -, *) | — | `:175-189` | same | Skeleton / error line / two empty drawers with the same words and link |
| I7.3 | The card: *Line N of M · employer · question q of Q*; the bullet in quotes; the follow-up (`q.ask`); why it's asked (`q.because`) | One bullet, one question | `:190-195` | same | **A question ticket** (`QuestionTicket`): kicker *THE INTERVIEWER ASKS*, the position line, the follow-up as the 44 px serif question, the bullet quoted above it, *because* under it |
| I7.4 | **Answer out loud** (primary) / **Type it** | Stage ask → answering | `:196-201` | — | The ticket's two answer buttons (`options`) |
| I7.5 | Out loud: a clock counting up (`clockWords`, `role="timer"`), *Say it out loud, as in the room. Nothing is recorded.*, **Done** | Nothing records | `:202-208`, `interviewModel.js:98-101` | — | The clock as a mono figure inside the ticket + the same sentence + Next |
| I7.6 | Typed: *Your answer* textarea (autofocus), **Done** (disabled while empty), *Stays on this page — nothing is sent or kept.* | Nothing sent | `:209-217` | — | The ticket's text answer (kind `draft` with `onChange` / `onNext`) + the same sentence |
| I7.7 | Harder: *Then the interviewer pushes:* + `q.harder` + **Next question** / **Next line** | The harder follow-up | `:218-227`, `interviewModel.js:84-92` | — | The ticket turns to the harder follow-up; one square per question lights only when the person finished the harder one (proof, not opening) |
| I7.8 | **Another line** (when > 1 bullet, not on harder) | Skip to the next bullet | `:228-230`, `interviewModel.js:95` | — | The ticket foot's *Another line* |
| I7.9 | Small print: *Lines most likely to be probed come first.* + **run the honesty check** → `/tools/honesty` | — | `:233` | — | Kept under the ticket |
| I7.10 | ⭐ NEW (D203 (10)): the questions tag Gazetteer entries | — | — | — | Each follow-up names its entry (*Kafka*, *idempotency*) as a link once the Gazetteer exists; until then, no link (nothing invented) |

### I8 · Past sessions (`past`)

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| I8.1 | *No practice sessions yet* + lead (pace, filler words, structure) + *Nothing is recorded until the mock interview runs in draft…* + **Your debriefs** → `/app/interview/debrief` | Placeholder | `:330-335` | — | After view, section *Past sessions*: the dashed drawer with the same words + a link to the Debrief section |

### I9 · Debrief (`debrief`) — D203 (10): stays

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| I9.1 | Head *Two minutes while it's fresh* + lead (*Kept private to you — nothing here is shared.*) | — | `:261-262` | — | After view, section 01 *Debrief* |
| I9.2 | The form: **For** (select of upcoming applications, shown only when there are any; *No application*) · **Round** (Coding · System design · Machine learning · Behavioural · Other) · **When** (date) · **How it went** (— · Went well · Mixed · Went poorly) · **Questions you remember (one a line)** · **Notes** · **Save the debrief** (busy-disabled) | Logs a round; questions go into the bank under the round | `:263-281`, `:247-257` | `POST /api/interview/debriefs`, `GET /api/interview/upcoming` | **One question at a time** (`QuestionTicket` kinds `choice` / `text` / `yesno` / `draft`): For → Round → When → How it went → Questions → Notes → Save. Every field kept, same order, same words |
| I9.3 | Messages: *Saved. Its questions are in your bank, under its round.* / the error | — | `:254-255` | — | The ticket's status line (`aria-live`) |
| I9.4 | The list: per debrief *Round · Company · Title* (when linked), date · how it went · N questions, notes | Your past debriefs | `:284-293` | `GET /api/interview/debriefs` | A gazetteer under the ticket (Round · For · When · How it went · Questions) |
| I9.5 | Empty *No debriefs yet.*; error line | — | `:282-283` | — | Empty drawer / error line |
| I9.6 | Delete a debrief — API only (`DELETE /api/interview/debriefs/:id`; the Prep tab offers no delete either) | — | `routes/interview.js:80` | DELETE | ⚠ not on any screen today; the gazetteer row could carry it — **owner's call** (unclear row U1) |
| I9.7 | ⭐ NEW (D203 (10)): the debrief's questions tag Gazetteer entries | — | — | — | As I7.10 |

### APIs this page reads or writes

`GET /api/interview/upcoming` · `GET /api/interview/questions` · `GET /api/interview/stories` · `POST /api/interview/stories/from-profile` ·
`GET /api/interview/defend` · `GET|POST /api/interview/debriefs` (+ `DELETE …/:id`, unused by the page) · the Prep tab's
`GET /api/interview/prep/:id`, `PUT …/date`, `POST|PUT|DELETE /api/interview/stories[/:id]`, `…/connector-data`.

### Rows whose home is unclear (for the owner at M4)

- **U1** — *Delete a debrief* exists in the API but on no screen. Offer it on the debrief's row, or leave it API-only?
- **U2** — Where the nine addresses land: this brief proposes four views with the nine as sections (`/app/interview/defend` →
  Practise, scrolled to Defend). The alternative is nine views in the area nav (+ More). The owner picks at M4.
- **U3** — *Ask the coach* (D161) and *Mock interview* (D161) are two drawers for one unbuilt feature; merge into one
  *The coach — coming* section?
- **U4** — D198's Format B scenario explainers' *practise it* step is to be hosted here (Wave 2 #13's idea); nothing exists yet,
  so the mock shows no place for it. It would be a section of Practise.

## M2 · The brief (the page recipe)

- **Atlas name:** **Proving ground** — the place where you prove you can do it in the room. Its parts: **the rounds** (the
  route of round types, Recruiter screen → AI-enabled coding), **interview tickets** (each upcoming round as a perforated
  ticket), **the defence** (Defend your résumé, the operable model), **the story bank**, **the debrief** (a register you fill
  one question at a time), **drills** (onward tickets into Atlas's entries).
- **Views (the area nav):** *Coming up · Prepare · Practise · After* (the four groups of today) + search (*Company or round…*);
  no pill; the chip = the next interview's countdown is **not** proposed (NavChip has two kinds, drafts and run; a third kind
  would be a new piece — owner's call at M4).
- **Region palette:** **VI · Languages & media** (`--pl-r6` #2F6B7A, tint #EAF3F5): interviews are spoken, and VI is used by
  no Wave 1 page (the market and the survey sheet wear IV). ✅ VI's 10-step ramp is built (47k): `--pl-vi-0…9` in
  `styles/plate.css`, listed in the design doc's ramp table (#2F6B7A at step 7). Plus clay, green and ink.
- **The single clay point:** the **soonest interview's ticket** (*Prepare →*) on Coming up; on Practise, the Defend ticket's
  primary answer button; never both on one screen.
- **Hero plate:** **drawing needed — "the proving ground"**: a terrain you climb, the five rounds as benches up a hill,
  you beaconed at the round you're preparing for, the next interview flagged in clay (VI's ramp). The nearest existing
  drawing is `PlaceElevationProfile` (Region IV), whose shape could be re-inked in VI. Mock: a labelled placeholder plate.
  Beside it: the one-line header + a stats strip (*interviews ahead · questions in your bank · stories · debriefs*).
- **Sections, each with one drawing:**
  - *Coming up* — 01 **Your interviews** (tickets) · drawing: none needed beyond the hero (the tickets are the drawing's data).
  - *Prepare* — 01 **The rounds** (RouteLine + counts) · drawing needed: *the rounds as benches on the climb* (could be the
    hero's inset) · 02 **Your story bank** · drawing needed: *a card catalogue of STAR stories* — the existing
    `CatalogueCard` is the nearest (each story a ruled card), so no new drawing · 03 **How each company interviews** →
    survey sheets (D203 (9)) · onward tickets.
  - *Practise* — 01 **Defend your résumé** (the model) · drawing needed: *the interviewer's chair across the table* ·
    02 **Drills** (onward tickets) · 03 **Mock interview / the coach** (not yet drawers).
  - *After* — 01 **Debrief** (one question at a time) · drawing needed: *a ruled logbook page* · 02 **Past sessions** (drawer).
- **The one operable model:** **Defend** — the walk ask → answer (out loud with a clock, or typed) → harder → next; the
  caption changes (`aria-live` on the ticket); nothing is recorded.
- **Squares:** three per bullet, one per follow-up finished to its harder question (proof = you answered it, never for
  opening). They're per session (Defend keeps nothing today) — **the owner decides at M4 whether they persist** (they'd be the
  first stored Defend data).
- **Onward tickets (end of every view):** *Prepare for Kestrel → the Job workspace's Prep* · *How Kestrel interviews → the
  survey sheet's Interviewing here* · *Drill the skill they ask most → its Gazetteer entry / Your survey* · *Log the round →
  Debrief*.
- **Every mark answers (D200 Rule 2):** the stats cells jump to their sections; a round stop opens its gazetteer row; a
  ticket's company opens its survey sheet.

## M3 · The mock

`client/src/pages/dev/platePages/Interview.jsx` — `InterviewMock({ width })`, built only from `client/src/plate/`
(AreaNav, Kickers, PageTitle, StatsStrip, PlateHero, LegHeader, Ticket, RouteLine, Gazetteer, QuestionTicket, Drawer,
Stamp, LitSquares) and `--pl-*` tokens; synthetic people and companies (Maya Chen, Kestrel Payments, Northwind, Halcyon).
New library piece it needed: **`DrawingToCome`** (`plate/Drawings.jsx`, registry entry) — every drawing marked *drawing
needed* above is that placeholder. All four views are in the mock (the area nav switches them; `&panel=` picks one for a
screenshot). Defend is operable (ask → out loud / type → harder → next line).

## M5 · What was built (47m, lane practice + the coordinator — the 47n record)

- **Interview is the Proving ground** (`pages/interview/ProvingGround.jsx`, `interviewModel.js`, `plate/practicePlate.css`),
  Region VI, from the approved mock and the `ProvingGround` board. The shell's area nav carries Coming up / Prepare /
  Practise / After (`useInterviewAreaNav`); the nine old panel ids open their view scrolled to their section
  (`INTERVIEW_HOMES`).
- **Every M1 row kept:** the tickets per interview (the soonest = the one clay point — `ComingTicket`: the when, company ·
  round, the tear, Prepare), the rounds as a route + the bank gazetteer, the story bank + *Start from my experience*,
  D203 (9) the company guides → the survey sheet's *Interviewing here*, Defend (the operable model, the chair drawing,
  this-session squares), Drills, the mock + coach drawers, the debrief one question at a time (same fields, same POST),
  the debriefs gazetteer, Past sessions. The classic `InterviewPage(.jsx/.css)` is deleted.
- **The hero is the board's** (the hill card first at 1 1 520, the column beside it, the 1180 measure). ⭐ Agent's pick — the
  hill lights no bench and no "you" until a round is proved; the page keeps the plate's centred measure (named in d163).
- **Drawings ported** (`scripts/d196PortDrawings.mjs` reads the boards directly): the hill, the interviewer's chair.
- **F5:** `pg-hero` 0.67 %, `pg-coming` 1.09 %, `pg-hill`, `pg-chair` — no LOOK.

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).

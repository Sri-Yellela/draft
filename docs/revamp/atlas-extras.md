Status: M1–M3 done (47j, lane w2-practice) · ⏸ awaiting the owner's M4 look

# D197 Wave 2 #11 · Atlas's own extras → **the Logbook** and **the Today card** on *Your map*

Wave 2's row #11 named three surfaces — **Today's question · League · Your run** (D154 daily practice, D172 league, points /
levels / marks). D203 (owner 11-26, "yes to all") gave them their homes, and this brief follows them exactly:

- **Your run** (A2–A2e) → **the Logbook**, D203's one new part, a section of *Your map*: lit days, waypoints, stamps,
  standings. The run chip in Atlas's area nav stays.
- **League, Challenges, the shared bar** (C1–C3) → **League standing in the Logbook**; **Challenges = timed runs over a
  route** (*Beat the bar*, *Time attack*, *Friday duel* each pick a route); **the shared bar** opens its route + the audit.
  All still behind the Compete switch.
- **Today's question** (A6, A6a, "N to review") → **the practice engine behind entries**: a ***Today* card on Your map**
  picks entries due for review; the Gazetteer index gets a *Due* filter; the reminder lives in notifications.
- **Practice progress** (A6b) → the Logbook; **stack exposure** (A6c) → Your survey (D203 (11)).

The summary rows (A2…, A6…, C1…) are in `docs/revamp/atlas-interview-m1.md`; this file is the full inventory under them
(same numbers, `.n` for each part) and only adds what that file misses. ⚠ That file's A6b / A6c *Proposed home* cells were
swapped against D203 (11) (practice progress said "Your survey", stack exposure said "the Logbook"); corrected there in this
lane's commit. **No live page changes until Wave 1 (#8) has landed and the owner has looked (M4).**
Mocks: `client/src/pages/dev/platePages/Logbook.jsx` → `/dev/plate?page=logbook` (`&compete=0` hides what the switch hides)
and `TodaysQuestion.jsx` → `/dev/plate?page=todays-question` (`&w=390` for both).

## M1 · Every control, view, state, link and behaviour today (from the code, 47j)

Files: `client/src/pages/atlas/YourRun.jsx` (186) + `yourRunModel.js`; `AtlasPanels.jsx:165-292` (Today's question, its
reminder, practice progress, stack exposure) + `BankAnswers.jsx` (match / order answers); `CompetePanels.jsx` (253) +
`competeModel.js`; the run chip `AtlasVolume.jsx:98-134`; the router `AtlasPage.jsx:411-420, 476, 485-489`; the nav
`atlasPanels.js:17, 25, 35-45`.

### A2 · Your run (`/atlas/your-run`) → the Logbook

| # | Element | What it does today | file:line | API | Where it lives now |
|---|---|---|---|---|---|
| A2.1 | Signed out: *Sign in to start your run. Points come only from proof — …* | Says how points are earned | `YourRun.jsx:47-51` | — | The Logbook's signed-out drawer, same sentence, + *Sign in* (Atlas home's signed-out *Get started*, D203 (4)) |
| A2.2 | Loading *Opening your run…*; error line | — | `:52, 68` | `GET /api/atlas/run` | Skeleton / error line + Try again (R1) |
| A2.3 | The level ring (% to the next level) + *Level N: Name* (h1) + *T of A points to Level N+1* (or *the top level*) + the rule line | Your level from proof | `:14-23, 72-78`, `yourRunModel.js:5-14` | same | Logbook header: a **compass dial** (one tick per tenth of the level, lit green) + the level as the section's serif title + the points line + the rule as small print |
| A2.4 | Streak (*N day streak* / *prove something today to start a streak*), *Best: N days*, *+N this week* | Three figures | `:79-83` | same | A **stats strip**: STREAK · BEST · THIS WEEK · POINTS (every cell answers: streak/best → the lit days, this week → the waypoints) |
| A2.5 | ⭐ A154: the pod's rank (link → `/atlas/league`) and the live count — only when their switch is on and they exist | Social proof | `:87-92` | same (`run.pod`, `run.live`) | The **standings** part of the Logbook (behind the Compete switch), with the live count as its kicker |
| A2.6 | The month of lit squares (proof = lit, rest day dashed, weekend off, today outlined; a title per square) | Your days | `:94-99` | same (`run.month`) | **The lit days** (`LogbookDays`, new library piece): today in clay (the design doc's "clay = today") |
| A2.7 | Note card *One real thing a day* (what lights a day; one rest day a week) | The rule | `:101` | — | Small print under the lit days |
| A2.8 | **Weekdays only — weekends never break it** (checkbox) | Saves the preference; re-reads the run | `:54-56, 102-104` | `PUT /api/atlas/prefs`, `GET /api/atlas/run` | The same checkbox under the lit days (weekends then draw hatched, *not counted*) |
| A2a.1 | *Today · about N minutes* + the quests: title, detail, lesson; *+N points* / *about N min* / *✓ done today*; **Start →** (explain → the Learn piece; prove → Your skills `?prove=`; today → Today's question; deck → the deck) | Daily things to do | `:107-126`, `yourRunModel.js:17-24` | same (`run.quests`) | **Waypoints**: each quest a perforated ticket (*NEXT WAYPOINT*), the first undone one in clay (the page's one clay point); done ones lit with ✓. Under D201 the hrefs become entry addresses (explain / prove / today = the entry's practice) |
| A2a.2 | No quests: *Nothing to do today — add a skill on Your skills, or open the Library.* | — | `:109-110` | — | The waypoints' empty drawer, same words + the two links |
| A2b.1 | *Proven: you can add A, B, C and N more to your résumé* + **Add them to your résumé** (reads the profile's skills, appends the proven ones not there, saves) + *Added to your profile's skills.* | Proof into the résumé | `:57-67, 128-134` | `GET /api/profile/sections`, `PUT /api/profile/sections/skills`, `GET /api/atlas/run` | Your survey (as the m1 row A2b says) — **and** a one-line onward ticket in the Logbook (*3 proven skills not on your résumé → Add them*) so the reward stays where it is earned. ⚠ unclear row U1 |
| A2b.2 | ⭐ D185-4 unlocks: *N open jobs in your role ask for X — M move into your top matches*, each job (title → `/app/jobs?job=`, company, before → after of your top skills) | What proof unlocks | `:39-46, 136-146` | `GET /api/atlas/unlocks?skill=` | Your survey (with A2b.1); the Logbook's onward ticket links there |
| A2b.3 | **See your skills** → `/atlas/your-skills` | — | `:147` | — | Your survey |
| A2c.1 | Proof page: *Your public profile lists what you've finished and proven* + `/in/<handle>` (new tab), or *Show it on your profile in Your profile → Behind your profile* | Links proof to the profile | `:36, 150-159` | `GET /api/profile/proof-page` | The Logbook's last onward ticket (*Your passport*, D197 #9) |
| A2d.1 | Marks: earned (a seal per module, its title) and next (a ring with done of total) | Badges for wholes | `:160-186` | same (`run.marks`) | **Stamps** (D203 (7)): an earned mark = a stamp (*ROUTE COMPLETE · I · FOUNDATIONS*); a next one = its route name + lit squares *done of total* |
| A2.9 | The run chip in Atlas's area nav (this week Mon → Sun, lit / today; label *Your run: N of 7 days lit this week*; → `/atlas/your-run`) | Glanceable streak | `AtlasVolume.jsx:98-107, 133-134` | `GET /api/atlas/run` (via useVolume) | **Stays** (D203 (1)); its link goes to Your map's Logbook (`/atlas/your-map#logbook`); `/atlas/your-run` forwards there |

### A6 · Today's question (`/atlas/todays-question`) → the Today card

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| A6.1 | Head: eyebrow *Picked for you · <reason>*; title *One question a day*; lead = the Atlas streak (*answering counts for today*) or *About two minutes. A review comes back when you miss one.* | Why this one | `AtlasPanels.jsx:246-248` | `GET /api/learn/today?day=<local day>` | **The Today card on Your map**: kicker *TODAY · PICKED FOR YOU · <reason>*, the streak line under it |
| A6.2 | Errors: 401 → *Sign in to get a question a day, picked from your own gaps.*; else the error; loading *Picking today's question…*; *No question to ask yet — there's nothing new for you today.* | — | `:236, 249-251` | same | Signed-out drawer / error line / skeleton / the empty drawer (*nothing due today*) |
| A6.3 | The question as draft's card in its skill's pastel with two backs, the skills line, the stem | One question | `:258-262` | same | A **question ticket** (`QuestionTicket`) in Your map's palette (no pastels — the plate's tokens), the skills as its kicker |
| A6.4 | Choice answers (buttons; right / wrong marked after) | Answer | `:265-270`, `:237-243` | `POST /api/learn/today/answer` `{ day, chosen }` | The ticket's answers; right → green + LIT stamp; wrong → dashed, struck through (the design doc's register feedback) |
| A6.5 | Match and order answers (`MatchAnswer`, `OrderAnswer`) | Answer by matching / ordering | `:263-264`, `BankAnswers.jsx` | same `{ day, response }` | ⚠ **no plate piece yet** — a *match* and an *order* answer for QuestionTicket are needed at M5 (shared with PieceQuestions, A4f); the mock shows the choice type and says so |
| A6.6 | After answering: *Right.* / *Not quite.* + why; *The stronger move: …*; **Go to lesson** links (Learn pieces); **Mini-lesson** links (decks); *Come back tomorrow for the next one.* (match / order: *N of M in place.*) | Teaches the why | `:271-287` | same | Under the ticket, `aria-live`; *Go to lesson* → the **Gazetteer entry** (D201), *Mini-lesson* → the entry's explainer |
| A6.7 | One streak: answering lights the day on Your run (A155) | — | `:247` | same (`atlasStreak`) | The answer lights today's square in the Logbook (same page now) |
| A6a.1 | The reminder: *Remind me each day at <hour> by <notification / email>* · *only on days you haven't answered.*; off until turned on; the local hour and offset | A daily nudge | `:165-192` | `GET|PUT /api/learn/today/reminder` | **Notifications** (D203 (3)); the Today card keeps a one-line link *Remind me daily → notifications* |
| A6b.1 | Practice progress (details): the level from proof + *N more for "word"*; rest days counted; *right of answered* per skill (3+ answers, last 20); *Your level rises when you prove a skill…* | Accuracy by skill | `:196-212` | `GET /api/learn/practice-progress?day=` | **The Logbook** (D203 (11)): a gazetteer *Practice by skill* (skill · right of answered) under the level |
| A6c.1 | Stack exposure (details): *Your stack on the board · scope*; per tech: open, share %, trend words; the window line | How much the board asks for your tech | `:215-229` | `GET /api/learn/stack-exposure` | **Your survey** (D203 (11)) — not in these mocks |
| A6.8 | ⭐ NEW (D203 (3)): the Gazetteer index's *Due* filter | Entries due for review | — | (the spaced-review rule, `PieceQuestions` 1 → 3 → 7 → 21 days) | A filter chip *Due · N* — shown in the Today mock as the card's onward link (the index itself is unsketched, D201) |

### C1–C3 · Compete (behind the switch: `GET /api/atlas/compete` → `{ league, challenges }`)

| # | Element | What it does today | file:line | API | Where now |
|---|---|---|---|---|---|
| C0.1 | The switch: Compete's nav group and the area nav's *League* view show only when on; off → *This isn't available yet.* / *Sign in to see …* | — | `AtlasPage.jsx:411-417, 487-488`, `atlasPanels.js:35-45`, `AtlasVolume.jsx:118` | `GET /api/atlas/compete` | Unchanged rule: the Logbook's standings and the challenge tickets draw only when on |
| C1.1 | Join card: *Join <pod>*, the rule, **Your handle** (≤ 24, suggested), **Join this week's league**, the error, *Resets in … — Monday 00:00 UTC.* | Opt in | `CompetePanels.jsx:27-48` | `GET /api/atlas/league`, `POST /api/atlas/league/join` | Standings' empty state: the join form in the drawer (same fields, same words) |
| C1.2 | The head: tier badge (shield), the line, *Resets in …* | — | `:67-73`, `competeModel.js:5-12` | same | Standings' kicker (*SILVER TIER · RESETS IN 4 DAYS*) + a stamp for the tier (the shield → a stamp; no new drawing) |
| C1.3 | The podium (top three: avatar letter, place, handle, points; you marked) and the rows (place, letter, handle *(you)*, movement ▲ / ▼ / –, points; the promotion line) | Standings | `:74-99`, `competeModel.js:15-27` | same | **The standings gazetteer** (place · handle · move · points), your row marked *YOU*, a rule under the promotion place + its sentence |
| C1.4 | The gap: words, a bar, **<move> · +N** (→ Your skills or Your run), **Challenge someone** → Challenges | How to close the gap | `:100-110` | same | Under the standings: the line + the move as a waypoint ticket + *Challenge someone →* the challenge tickets |
| C1.5 | *In your pod*: the proof feed (handle, words, +points) | Proof, never failure | `:111-116` | same | A short list under the standings |
| C1.6 | Footer line + **Leave the league** | Opt out | `:117-120` | `DELETE /api/atlas/league` | Standings' foot, same button |
| C2.1 | Challenges head + the rule (*earn no points*) | — | `:189` | `GET /api/atlas/challenges` | The challenge tickets' kicker |
| C2.2 | **Beat the bar**: take the 3-minute audit for a role and share; your bars (line + **Share the score** → copies the link, or *Shared link*); *Link copied: …*; *Take the audit →* | Share a score | `:179-186, 195-205` | `POST /api/atlas/challenges/bar/:token/share` | A **timed run over a route** (D203 (2)): the ticket picks the route (the role's route), runs the audit over it; share kept |
| C2.3 | **Time attack**: 5 reviewed questions for a role, N seconds each; your best this week; **Role** select; **Timed / Extended time / Untimed**; **Start** | A timed run | `:177, 206-217` | `GET /api/audit/roles`, `POST /api/atlas/challenges/time-attack` | A route ticket: *pick a route* (was a role) + the three modes (kept, D142) + Start |
| C2.4 | **Friday duel**: the same five for the pod; scores; played / open / *Opens on Friday.* / *Join this week's league →* | Weekly duel | `:178, 218-230` | `POST /api/atlas/challenges/duel` | A route ticket; the scores join the standings |
| C2.5 | The runner: *Question n of N · mode · N seconds*, the stem, choices, *Right.* / *Right, but past the timer.* / *Not that one.* + why, the end score; **Back to challenges** | Runs the five | `:127-154, 191-192` | `POST /api/atlas/challenges/:runId/answer` | The same ticket in run mode (a `QuestionTicket` with the timer as its kicker) — **mocked as a static ticket**, M5 builds the run |
| C3.1 | `/atlas/bar/<code>`: *Opening…*, *That link doesn't open a score.*, the shared line + *Take the <role> audit →* | A public shared score | `:237-253`, `AtlasPage.jsx:420, 489` | `GET /api/atlas/bar/:code` | D203 (2): the shared bar **opens its route + the audit** (a route page with the score as its kicker) — waits on Routes (D201, unsketched); see the list below |

### Rows whose home is unclear (for the owner at M4)

- **U1** — *Add them to your résumé* + the unlocks (A2b): m1 says Your survey; the Logbook is where the proof is earned. This
  brief keeps the action on Your survey and puts a one-line ticket in the Logbook. Owner: both, or one?
- **U2** — The level ring: a compass dial (ticks) is proposed; the design doc's *Compass dial* is "needle = progress". A
  separate *level ring* piece would be new. Owner's look at M4.
- **U3** — Match / order answers (A6.5) need a library piece before M5 (one piece for Today and the entries' practice).
- **U4** — Where `/atlas/your-run`, `/atlas/todays-question`, `/atlas/league`, `/atlas/challenges` land: proposed
  `/atlas/your-map#logbook`, `#today`, `#standings`, `#challenges` (the addresses keep working; D200 Rule 1).
- **U5** — The tier shield (C1.2) is a drawing today; the brief makes it a stamp. If the owner wants the shield, it's
  *drawing needed*.

## M2 · The brief (the page recipe)

**What these are in the atlas:** not pages — **two parts of *Your map***: **the Logbook** (the expedition log: lit days,
waypoints, stamps, standings) and **the Today card** (the day's practice pick). *Your map* is the person's own sheet; its
other parts (Your survey's kept skill map, D200 (a)) are Wave 1's. The mocks draw *Your map*'s frame (the Atlas area nav, the
one-line header) with only these two parts in it.

- **Atlas names and parts:** *The Logbook* — **lit days** (the month), **the level** (a dial), **waypoints** (today's quests
  as tickets), **stamps** (routes complete), **standings** (League, behind Compete), **runs** (Challenges = timed runs over a
  route, behind Compete), **practice by skill**. *The Today card* — **today's pick** (one question ticket), **why** (the
  answer's reason), **onward** (the entry, the explainer, *Due · N* in the Gazetteer, the reminder in notifications).
- **Region palette:** *Your map* is the person's own sheet across all regions, so it wears **Region IV** (the default the v3
  boards and Atlas's region page wear) — plus clay, green, ink. A waypoint or stamp from another region shows that region
  only as its chip (*⇄ III*), never as a fill.
- **The single clay point:** the Logbook — **the next waypoint** (the first undone quest) and today's square (the design
  doc's "clay = today" for squares); the Today card — **the question ticket's current progress square** only (its answers stay
  ink until answered; right = green).
- **Hero plate:** none of their own (they are sections of Your map, whose hero is Wave 1's). Each section's drawing below.
- **Sections, each with one drawing:**
  - *01 Lit days* — the drawing **is** the grid (`LogbookDays`).
  - *02 Waypoints* — **drawing needed: "the day's leg"** — today's quests as stops on a short trail (could reuse `RouteLine`
    as data; the mock uses RouteLine, no new art).
  - *03 Stamps* — the stamps themselves (`Stamp`), no extra drawing.
  - *04 Standings* (Compete) — **drawing needed: "the pod's summit cairn"** (optional; the gazetteer carries the data). Mock:
    placeholder.
  - *05 Runs* (Compete) — the route the run goes over (`RouteLine`).
  - *Today card* — **drawing needed: "today's square on the map"** — a small inset with the entry's region and today's beacon;
    mock: placeholder.
- **The one operable model:** the Logbook — **the lit days** (tap a day → what lit it; the weekdays-only switch redraws the
  weekends); the Today card — **answering** (the ticket turns: right green + LIT, wrong dashed + struck, the why appears,
  today's square lights in the Logbook).
- **Squares:** the lit days *are* squares (proof that day); a stamp's next route shows *done of total* squares; the Today card
  lights **one** square — today's — only on an answer.
- **Onward tickets:** Logbook → *3 proven skills not on your résumé → Your survey* · *Your passport → /in/<handle>* ·
  *Challenge someone → a run*; Today → *the entry it came from* · *Due in the Gazetteer · N* · *Remind me daily →
  notifications*.

## M3 · The mocks

- `client/src/pages/dev/platePages/Logbook.jsx` — `LogbookMock({ width })`: Atlas's area nav (VOL. I pill, the run chip),
  the one-line header, then the Logbook's sections; Compete on by default (`&compete=0` shows it off). Operable: the
  weekdays-only switch and tapping a day.
- `client/src/pages/dev/platePages/TodaysQuestion.jsx` — `TodaysQuestionMock({ width })`: the Today card on Your map, a
  choice question; answering turns it (right / wrong), shows the why and lights today's square; *&state=* `empty`,
  `signedout`, `answered` for the other states.
- Library pieces added in this lane: **`LogbookDays`** (`plate/Marks.jsx`) and **`DrawingToCome`** (`plate/Drawings.jsx`),
  each with its registry entry (four states + extremes).

## Classic Atlas places with no Wave row

These stay classic (PlaceNav + `atl__*` styles) and **wait on D201's Gazetteer** (Wave 1 #8's place / entry and the Gazetteer's
index + a route — *sketches pending*, D201 NEXT). No mock here. Each with its D201 / D203 home (rows from
`atlas-interview-m1.md` where it has them):

| Place | Route | Code | Home (D201 / D203) |
|---|---|---|---|
| Course page *From silicon to software* (and any course in `COURSES`) | `/atlas/library/silicon-to-software` | `LibraryPanel.jsx:230` (`CoursePage`), `LessonDeck.jsx` | **A route** (D201 (2)); each lesson → a Gazetteer entry; outside links → the Library (m1 A4d) |
| The Learn circle (ring, chords, *Make sense of…*, explain, link a build) | `…?view=circle#step-<id>`; `/atlas/learn` redirects there | `LearnCircle.jsx:269`, `LearnView.jsx:70`, `AtlasPage.jsx:458` | **Routes**: the circle = a route's overview view; *Make sense of…* = Gazetteer search making a route on the spot (D203 (8), A4e) |
| Coding interview patterns | `/atlas/library/coding-interview-patterns` | `LibraryPanel.jsx:172` (`PatternCoursePage`) | Each pattern → an entry; the course → a route; LeetCode links → the Library; Interview's Drills links to it (A4g) |
| The shelf of draft's own courses, guides, pathways | `/atlas/library/shelf` | `LibraryPanel.jsx:124` (`LibraryShelf`), `LibraryGuides.jsx`, `PathwayArt.jsx` | **Routes** (courses / pathways become routes, D201 (2), P7); *Build it* briefs → **project routes** (D203 (6)); the spines only for real books, in the Library (A4, A4h, A4i) |
| A guide, a level, a deck (5 slides, Watch / Read / Cards, last-slide check, DeckWorld) | `/atlas/library/<guide-or-deck>[?play=]` | `LibraryGuides.jsx:226` (`LibraryItem`), `:110, :138`, `DeckPlay.jsx` | A guide → a route; a deck → **a Gazetteer entry's explainer + practice**; DeckWorld → the entry's links (A4a–A4c) |
| How it works | `/atlas/how-it-works` | `AtlasPanels.jsx:507` | **Gazetteer**: each concept's parts = an entry's *Why it works* diagram (D201 (6), A5) |
| The audit (role picker, AuditCard) + the public 3-minute audit | `/atlas/the-audit`; `/audit?role=` | `AtlasPanels.jsx:300, 320`; `pages/audit/AuditPage.jsx:19` | The card → the market; the audit → **entry practice** (a run across entries) and **Your survey** (it fills the plots fast, D203 (6)) (A7, A7a) |
| Roles and skills (search + why it matched, by role, New in the Atlas) | `/atlas/roles-and-skills` | `AtlasPanels.jsx:361`, `YourMap.jsx:12, 28` | **Gazetteer** — its index (browse by role) and search (D201 (6), A8) |
| This week's market (top 4 roles, open + new) | `/atlas/this-weeks-market` | `AtlasPanels.jsx:379, 404` | **Your survey** and **the market** (D201 (6), A9) |
| Glossary (A–Z, meaning, postings, Open in Atlas, Learn it) | `/atlas/glossary` | `AtlasPanels.jsx:449, 485` | **Gazetteer** — its A–Z (D201 (6), A10); the in-posting peek (`AtlasTerm`) → the entry's summary card (A10a) |
| Node pages (role / skill / tool / stack: aliases, definition, have / missing, Learn it / Prove it, board, map, next, sponsors, roles, pay, related graph, resources) | `/atlas/<slug>` | `AtlasPage.jsx:131-203`, `atlasModel.js:194`, `AtlasGraph.jsx` | **A Gazetteer entry** (it already is one): the anatomy of D201 (1) — the compass of links = the related graph; resources → Library-sourced; a role's board / pay / sponsors also feed the market (A8a, A8b) |
| Search | `/atlas?q=` (an exact name or alias lands on its page) | `AtlasPage.jsx:52-61, 454` | **Gazetteer search** — *Make sense of…* in the area nav (already its placeholder); the answer page = the index filtered (A8) |
| The shared Beat-the-bar score | `/atlas/bar/<code>` | `CompetePanels.jsx:238` | **The shared bar opens its route + the audit** (D203 (2), C3); behind the Compete switch |

Also still classic and already homed in `atlas-interview-m1.md` (Wave 1 lanes own them): *Your skills* + the readiness check
(`/atlas/your-skills`, `/atlas/check` → Your survey, A3 / A3a), *Your route* / the navigator / the track board (→ Routes,
A1d / A1e), family pages (`/atlas/family/<key>` → the Region page, D203 (5)), the signed-out Overview (→ Atlas home's
*Get started*, D203 (4)).

## M5 · What was built (47m, lanes practice + gaz + the coordinator — the 47n record)

- **Your run → the Logbook** (`pages/atlas/Logbook.jsx`), a section of Your map: the level as a compass dial, the streak
  strip, the lit days (`LogbookDays`, weekdays only), waypoints (the day's leg + a ticket per quest, the first undone in
  clay), stamps for finished modules (D203 (7)), practice by skill (D203 (11)), Standings behind Compete (join, the tier as a
  stamp, the summit cairn, the rows, the gap, the pod's proof, Leave), Runs, Onward.
- **Today's question → the Today card** (`pages/atlas/TodayCard.jsx`): the pick as a question ticket, match / order via
  `BankAnswers`, the why, today's square inset; answering lights the Logbook's day. Stack exposure → Your survey.
- **Forwards:** `/atlas/your-run`, `/todays-question`, `/league` → `your-map#logbook` / `#today` / `#standings`.
  Deleted: `YourRun.jsx/.css`, `TodaysQuestionPanel`, `LeaguePanel`.
- **The Gazetteer (Wave 1 #8, D201)** replaces the node page, glossary, library shelf and lesson deck — see
  `docs/revamp/atlas.md` § *The Gazetteer*. The node page's panes a Gazetteer entry had dropped (a role's board: skills with
  shares, levels, pay, companies; its map; the next level; every sponsor; roles / pay of a skill; the typed related lists;
  the few-postings line) are back as the entry's *More about it* (`pages/atlas/EntryMore.jsx`, D200 Rule 1).
- **F5:** `lb-leg`, `lb-cairn`, `lb-today`, `lb-tier` (the ported DrawingsAtlas 1–4).

**Verified:** the 47m runs on the merged tree — fast tier 6,334 (6,333 / 0 + 1 skip), browser tier 277 / 0, pushed `fdc1adb2` (production + staging). **Unknown:** not walked signed in on production (the owner's walk).

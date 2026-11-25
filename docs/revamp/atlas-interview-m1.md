# M1 · Atlas and Interview: every current tab and feature, and its proposed home under D201 (nothing lost, D200 Rule 1)

Read from the code on 11-25 (47h). D201's plan: Atlas's nav becomes **Your map · Gazetteer · Routes · Library · Your survey**. How it works and Glossary fold into the Gazetteer; This week's market and Roles and skills fold into Your survey and the market; Today's question and The audit become entry-level practice; Interview uses the same entries. A row marked **UNCLEAR** has no home in D201 yet, and those rows are listed at the end for the owner.

**Where things are defined:**
- Atlas nav: `client/src/pages/atlas/atlasPanels.js:12` (`ATLAS_NAV`: You · Grow · Explore) and `:38` (`COMPETE_NAV`, shown only when the owner switches it on).
- Atlas router: `pages/atlas/AtlasPage.jsx:357-483`, mounted at `/app/atlas` (`App.jsx:805`) and publicly at `/atlas` (`App.jsx:1054`).
- Interview nav: `pages/interview/interviewModel.js:13`. Page: `InterviewPage.jsx:297`. API: `routes/interview.js`.
- Cross-check: `docs/D167_ATLAS_MAP.md`.

Routes are written `/atlas/…` and also work under `/app/atlas/…`.

## Atlas

| # | Name | Route | Main file:line | What the person sees and does | API | Proposed home |
|---|---|---|---|---|---|---|
| A0 | Overview (signed out; signed in opens Your map) | `/atlas`, `/atlas/overview` | `AtlasPanels.jsx:57, 105` | Stat cards (skills checked, roles you can apply to, route length), next step, a Today's question teaser, links | `/api/atlas/me`, `/api/navigator`, `/api/readiness` | Your map (signed-out front door) · UNCLEAR as its own page |
| A1 | **Your map**: hero (N jobs you can apply for today, level tiles, JobsHistogram) | `/atlas/your-map` | `SkillMap.jsx:42, 194`; `AtlasPage.jsx:420` | Jobs you can apply for; how close you are to each | `/api/atlas/skill-map[?role=]` | Your map. **Kept whole on Your survey** (D200 (a)) |
| A1a | What <role> jobs want (SkillTreemap Map / List, role buttons) | same | `SkillMap.jsx:89`, `SkillTreemap.jsx` | The role's skills by demand | same | Your survey → the cadastral plot map (D200); each plot links to its Gazetteer entry |
| A1b | Learn next (LearnNextChart, hours, +N jobs, logos, Start / Prove, See these jobs) | same | `SkillMap.jsx:106` | An ordered route of skills with the job gain | same | Routes (a personal route), drawn on Your survey |
| A1c | Jobs you could move to (MoveRolesScatter, role cards, Show its map, **Aim for this**) | same | `SkillMap.jsx:143` | Adjacent roles; set your aim | + `PUT /api/navigator/aim` | Your survey |
| A1d | Your route, step by step: **TrackBoard** ("Fly my route") | same | `AtlasPage.jsx:430`, `TrackBoard.jsx:29` | The route as a looping track | `/api/navigator` | Routes |
| A1e | Navigator / YourRoutePanel (destination, lessons, bridges "apply now while you learn", re-routing) | same; `/atlas/your-route` | `AtlasPanels.jsx:144`, `Navigator.jsx:10` | Your route with a lesson per skill | `/api/navigator`, `PUT …/aim` | Routes |
| A1f | Family page (AtlasTree) | `/atlas/family/<key>` | `YourMap.jsx:70`, `AtlasTree.jsx:172` | A skill family's tree, yours coloured | `/api/atlas/tree/family/:key` | **UNCLEAR**: a group of entries (a Gazetteer category page, or a region of Your map) |
| A2 | **Your run** (level ring, streak, this week, month grid, weekdays-only) | `/atlas/your-run` | `YourRun.jsx:25` | Proof-based level and streak | `/api/atlas/run`, `PUT /api/atlas/prefs` | **UNCLEAR**: D201 has no progress place (the run chip in the nav?) |
| A2a | Today's quests | same | `YourRun.jsx:107` | Daily things to do, with points | `/api/atlas/run` | UNCLEAR (follows A2); each quest points at entry practice |
| A2b | Proven → Add them to your résumé + unlocks | same | `YourRun.jsx:128` | Proven skills into Profile; the jobs it unlocks | `/api/atlas/unlocks`, `/api/profile/sections`, `PUT …/skills` | Your survey |
| A2c | Proof-page link `/in/<handle>` | same | `YourRun.jsx:151` | Your public proof page | `/api/profile/proof-page` | Your survey / Profile |
| A2d | Marks (per whole module) | same | `YourRun.jsx:161` | Badges for finished modules | `/api/atlas/run` | Routes (a mark = a finished route) · UNCLEAR |
| A2e | Pod rank + live count (Compete on) | same | `YourRun.jsx:87` | League position | `/api/atlas/run` | UNCLEAR (follows League) |
| A3 | **Your skills** (claimed · checked · built; add / remove, Check it · 1 min, Add proof, `?prove=`) | `/atlas/your-skills`, `/atlas/check` | `AtlasPanels.jsx:129`, `YourSkillsPanel.jsx:80`, `components/SkillCheck.jsx:70` | Manage and prove your skills | `/api/your-skills` (+ skills, prove, checks, proof) | Your survey |
| A3a | Readiness check (adaptive; awareness summary) | same; Interview → Drills links here | `ReadinessCheck.jsx:28` | A per-skill check, then where you stand | `/api/readiness` (+ checks, answer) | Your survey (the check = entry practice) |
| A4 | **Library** shelf + "N to review" | `/atlas/library` | `LibraryPanel.jsx:124, 37` | Guides and courses as spines; review count | `/api/learn/checks`, `/course/:id`, `/earned` | Split: the shelf → **Routes**; the Library keeps outside resources only |
| A4a | Guide ladder (levels 1–4) | same | `LibraryGuides.jsx:29` | Guides by level | `/api/learn/guides` | Routes |
| A4b | Guide page (decks in order, ▶ Watch) | `/atlas/library/<guide>` | `LibraryGuides.jsx:110` | A guide's decks | same | Routes |
| A4c | **Deck page** (5 slides, Watch / Read / Cards, last-slide check, DeckWorld) | `/atlas/library/<deck>[?play=]` | `LibraryGuides.jsx:138`, `DeckPlay.jsx:12, 210` | A 5-slide lesson ending in a question | `/api/learn/deck/:id` (+ answer) | Gazetteer entry (explainer + practice); DeckWorld → the entry's links / resources |
| A4d | Course "From silicon to software" (CoursePage, HalfRing, LessonDeck, Marks, Read · Watch · Try + Check) | `/atlas/library/silicon-to-software` | `LibraryPanel.jsx:230`, `LessonDeck.jsx:15, 71` | Modules and lessons with links and checks | `/api/learn/course/:id`, `/earned`, `/circle`, `/checks` | Routes (the course); each lesson → an entry; outside links → Library |
| A4e | The circle (LearnView / LearnCircle / LearnWheel: 108 pieces, chords, "Make sense of…", explain, link a build) | `…?view=circle#step-<id>`; `/atlas/learn` | `LearnView.jsx:70`, `LearnCircle.jsx:269, 172, 114, 145` | A whole-course ring; progress by opening, explaining, building | `/api/learn`, `/circle`, `/circle/my-route`, `/earned`, `/opened`, `/explained`, `/built` | Routes (a ring view); explain / build → entry practice; "Make sense of…" → Routes (made on the spot) |
| A4f | PieceQuestions (spaced review 1 → 3 → 7 → 21 days) | inside A4e | `PieceQuestions.jsx:11`, `BankAnswers.jsx` | Answer the piece's bank questions | `/api/learn/piece/:id/questions` (+ answer) | Gazetteer entry practice |
| A4g | Coding interview patterns (PatternCoursePage) | `/atlas/library/coding-interview-patterns` | `LibraryPanel.jsx:172` | The patterns as a course | `/api/learn/course/:id` | Each pattern → an entry; the course → a route; LeetCode links → Library; Interview Drills uses it |
| A4h | Pathways shelf + "Every pathway" plan | `/atlas/library` | `LibraryPanel.jsx:86`, `LibraryGuides.jsx:50`, `PathwayArt.jsx` | Each role family's curriculum | `/api/learn/pathways` | Routes (planned topics = entries not yet written) |
| A4i | "Build it" briefs | inside A4h | `LibraryGuides.jsx:89` | Project briefs that count as proof | same | **UNCLEAR**: it spans several entries (a capstone stop on a route?) |
| A5 | **How it works** | `/atlas/how-it-works` | `AtlasPanels.jsx:507` | Each concept as its parts in order | `/api/learn/how-it-works` | Gazetteer entry (its diagram) |
| A6 | **Today's question** (choice / match / order, why, Go to lesson, streak) | `/atlas/todays-question` | `AtlasPanels.jsx:231` | One question a day from your gaps | `/api/learn/today` (+ answer) | Entry practice; **the daily picker: UNCLEAR** |
| A6a | Daily reminder (hour, push / email) | same | `AtlasPanels.jsx:165` | A reminder | `GET/PUT /api/learn/today/reminder` | UNCLEAR (Settings?) |
| A6b | Practice progress (level, rest days, per-skill accuracy) | same | `AtlasPanels.jsx:196` | Your accuracy by skill | `/api/learn/practice-progress` | Your survey |
| A6c | Stack exposure (your stack's open share, trend) | same | `AtlasPanels.jsx:215` | How much the board asks for your tech | `/api/learn/stack-exposure` | Your survey / Market |
| A7 | **The audit** panel (role picker, AuditCard, Take the 3-minute audit) | `/atlas/the-audit` | `AtlasPanels.jsx:320, 300` | A role's market card | `/api/audit/roles`, `/role/:slug` | The card → Market; the audit → entry practice |
| A7a | The 3-minute audit (public: 6 questions → result, claim, share) | `/audit?role=` | `pages/audit/AuditPage.jsx:19`; `App.jsx:1070` | Six role questions, strong / to work on | `/api/audit/…` (start, answer, result, claim) | **UNCLEAR**: a role run spanning several entries |
| A8 | **Roles and skills** (search `?q=` + why it matched, by role, New in the Atlas) | `/atlas/roles-and-skills`, `/atlas?q=` | `AtlasPage.jsx:58`, `AtlasPanels.jsx:361`, `YourMap.jsx:12, 28` | Search the dictionary; browse | `/api/atlas/search`, `/api/atlas/me` | Gazetteer (its index + search) |
| A8a | **Node page** (name, aliases, definition, have / missing, Learn it / Prove it, panes: board, map, next, sponsors, roles, pay, related + AtlasGraph, resources, Wikipedia) | `/atlas/<slug>` | `AtlasPage.jsx:203`, `atlasModel.js:194`, `AtlasGraph.jsx:6` | One page per role / skill / tool / stack | `/api/atlas/node/:slug` | **Gazetteer entry** (it already is one); resources → Library-sourced |
| A8b | Role node: RoleBoard, next level, RoleMap, H-1B sponsors | `/atlas/<role>` | `AtlasPage.jsx:131, 177`; `YourMap.jsx:53` | A role's board data | + `/api/atlas/tree/role/:slug` | Gazetteer role entry; board / pay / companies / sponsors also feed the Market |
| A9 | **This week's market** (top 4 roles) | `/atlas/this-weeks-market` | `AtlasPanels.jsx:379, 404` | Open + new counts by role | `/api/audit/roles`, `/role/:slug` | Market / Your survey |
| A10 | **Glossary** (A–Z, meaning, postings, Open in Atlas, Learn it) | `/atlas/glossary` | `AtlasPanels.jsx:449, 485` | Plain-words list | `/api/atlas/glossary` | Gazetteer (its A–Z) |
| A10a | AtlasTerm peek (hover a term in a posting) | in postings | `components/AtlasTerm.jsx:84, 46` | An inline definition | `/api/atlas/peek/:slug` | Gazetteer entry (its summary card) |
| C1 | **This week's league** (Compete switch) | `/atlas/league` | `CompetePanels.jsx:50` | Weekly pod by proof points | `/api/atlas/compete`, `/league` (+ join) | **UNCLEAR** |
| C2 | **Challenges** (Beat the bar, Time attack, Friday duel) | `/atlas/challenges` | `CompetePanels.jsx:164, 128` | Timed runs, shareable scores | `/api/atlas/challenges` (+ time-attack, duel, answer, share) | **UNCLEAR** |
| C3 | Shared Beat-the-bar score | `/atlas/bar/<code>` | `CompetePanels.jsx:238` | A shared score + take the audit | `/api/atlas/bar/:code` | UNCLEAR (follows C2 / A7a) |

## Interview

| # | Name | Route | Main file:line | What it does | API | Proposed home |
|---|---|---|---|---|---|---|
| I1 | **Your interviews** (Inbox invites matched to applications, countdown, Prepare) | `/app/interview/upcoming` | `InterviewPage.jsx:45` | Upcoming rounds, each opening its Prep | `/api/interview/upcoming` | Interview (stays) |
| I1a | Prep tab (date, skills vs yours with Atlas links, likely rounds, STAR stories, debriefs) | `/app/job/<id>?tab=prep` | `panels/JobWorkspacePanel.jsx:205` | Prep for one interview | `/api/interview/prep/:id` (+ date, stories, debriefs) | Interview; skill rows → Gazetteer entries |
| I1b | The connector pack (`draft_get_interview_prep`, a mock in your own Claude) | no screen | `routes/interview.js:54`, `services/byom/tools.js:128` | Data for your Claude to interview you | `/api/interview/prep/:id/connector-data` | Interview (could carry the entries' interview questions) |
| I2 | Company guides (coming soon) | `/app/interview/guides` | `InterviewPage.jsx:80` | Placeholder | — | **UNCLEAR**: per company → the survey sheet more than the Gazetteer |
| I3 | Tracks by round + story bank | `/app/interview/tracks` | `InterviewPage.jsx:94` | Your question counts per round; STAR stories | `/api/interview/questions`, `/stories` (+ from-profile) | Interview; round tracks could be routes |
| I4 | Mock interview (coming soon → the connector) | `/app/interview/mock` | `InterviewPage.jsx:308` | Placeholder + Set it up | — | Interview (entries) |
| I5 | Ask the coach / voice coach (D161, coming soon) | `/app/interview/coach` | `InterviewPage.jsx:316` | Placeholder | — | Interview (entries) |
| I6 | Drills (→ the readiness check, → Coding interview patterns) | `/app/interview/drills` | `InterviewPage.jsx:321` | Two links into Atlas | — | Interview on entry practice |
| I7 | **Defend your résumé** (bullet → follow-up → answer aloud or typed → harder follow-up) | `/app/interview/defend` | `InterviewPage.jsx:155`; `services/defendResume.js` | Practise defending each bullet | `/api/interview/defend` | Interview (résumé-based, stays) |
| I8 | Past sessions (coming soon) | `/app/interview/past` | `InterviewPage.jsx:330` | Placeholder | — | Interview |
| I9 | **Debrief** (log a round; its questions go into your bank) | `/app/interview/debrief` | `InterviewPage.jsx:238` | Log a round | `GET/POST /api/interview/debriefs` | Interview (questions could tag entries) |

## No home under D201 yet: for the owner (or the chat assistant's next sketch)

1. **Your run** (A2–A2e): the level ring, streak, month grid, quests, marks and pod rank. D201 has no progress place. Only "add proven skills to the résumé" and unlocks go cleanly to Your survey.
2. **League, Challenges, the shared bar** (C1–C3): there's no competition place. They're off by default but live, with server routes.
3. **Today's question's daily picker, its reminder, and the spaced-review rule** (A6, A6a, and the "N to review" line it shares with PieceQuestions): entry practice covers the question, not the picking.
4. **Overview** (A0): the signed-out front page.
5. **Family pages** (A1f): a group of entries, neither one entry nor a route.
6. **Build-it briefs** (A4i) and **the 3-minute audit** (A7a): each spans several entries.
7. **Marks** (A2d, and on the course page): an award for a whole route; Routes is likely but not stated.
8. **The Learn circle's ring, chords and "Make sense of…"** (A4e): a view of a whole route, plus a route made on the spot.
9. **Company guides** (I2): per company, so the survey sheet rather than the Gazetteer.
10. **Defend your résumé, Debrief, the story bank** (I7, I9, I3): they work from your own records, so they stay Interview-only.
11. **Stack exposure and practice progress** (A6b, A6c): these sit on Today's question today but are survey / market numbers, so they move explicitly.
12. "Practice registers" (named in D201's what-we-have list): there's no surface by that name. The only "register" in the code is the source register (Read · Watch · Try), which belongs to the Library.

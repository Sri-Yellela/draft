# D167 · Atlas's own navigation — where every existing surface lives

Owner, 11-06: *"approving the sketch but where is the glossary and everything"* — **"everything" = every Atlas surface
that exists today keeps a home in the new navigation; nothing existing is dropped.** This table was written before the
build (lane `d167-atlas`, 45b) from the code as it stood at `ceca8fac`, and `test/d167Atlas.test.js`
(`d167AtlasKeepsEverySurface`) holds the code to it.

The navigation (`client/src/pages/atlas/atlasPanels.js` `ATLAS_NAV`, drawn by `AtlasNav.jsx`, the panels in
`AtlasPanels.jsx`): **You** — Your run · Your map · Your skills — **Grow** — Library · How it works (A154, 45o: each approved deck's idea as one flow) · Today's question · The
audit — **Explore** — Roles and skills · This week's market · Glossary. ⭐ **D178 (45j, the nav regrouped):** Your route is
an alias of Your map (the navigator drawn under the track board); Overview is the signed-out front page (signed in, the
mount opens Your run); `/atlas/learn` redirects to the course's circle view (`/atlas/library/silicon-to-software?view=circle`,
`#step-<id>` kept) — see `docs/D178_ATLAS_INVENTORY.md`. Each panel is addressable: `/atlas/<panel>`
(public) and `/app/atlas/<panel>` (signed in); Overview is `/atlas` itself (and `/atlas/overview`).

## The mapping

| # | Surface that exists today | Where it came from | Its address before | Its panel now | How it is reached |
|---|---|---|---|---|---|
| 1 | **Search** (name, alias, prefix, typo, "in its definition"; an exact hit lands on the page) | D105 P4, BUG 10-31 | `/atlas?q=` | **Roles and skills** | the panel's search box; `/atlas?q=` still works and lights the panel |
| 2 | **A node's page** — definition, On the board, Related + the first-ring graph, Resources (Learn it first), From Wikipedia, *You: have / partial / missing* | D105 P4–P12, D115 P4b, D119 | `/atlas/<slug>` | **Roles and skills** | every link into the Atlas; the address is unchanged |
| 3 | **A role's page** — the board's own data (skills + shares, levels, pay, companies), the role as a tree, *To reach the next level*, sponsors | D105 P12, D116 M7, D121 | `/atlas/<role slug>` | **Roles and skills** | Explore by role, the audit's card, A111's role-fit, any link |
| 4 | **A family's page** (the family's full circle) | D116 M7 | `/atlas/family/<key>` | **Your map** | the families list in Your map; the address is unchanged |
| 5 | **Your map** — the tree, its header line, the résumé nudge, the five sections (To reach…, Adjacent, Branches, Learn next, You have) | D116, D120 P2 | `/atlas` (the home) | **Your map** | `/atlas/your-map`; the guided tour's *Your map* step now opens it |
| 6 | **The direction line** (*Next up: …*) | D120 P2 | the home | **Overview** (Next step) | Overview's *Next step* card (the navigator's next step first, this line as its fallback) |
| 7 | **The navigator** — where you're headed (aim, change it), your route with Learn pieces, changing fields, other fields, *Apply now, while you learn*, progress and re-routing | D143, D139 | the home, first | **Your route** | `/atlas/your-route`; its next step also on Overview |
| 8 | **Your course** (the circle with your earned progress and your map's route as ink) | D120 P2 | the home | **Your map** (as on the home) | below the tree in Your map; signed out, the full circle there |
| 9 | **Explore by role** (the board's biggest roles + top skills) | D120 P2 | the home's side column | **Roles and skills** | the panel |
| 10 | **The families** (what you have of each) | D120 P2 | the home's side column | **Your map** | Your map's side column |
| 11 | **Recently published** | D120 P2 | the home's side column | **Roles and skills** | the panel |
| 12 | **The signed-out / no-résumé home** (the upload line, the course) | D116 M9, D120 | `/atlas` signed out | **Your map** (the line + course) · **Overview** (signed-out lead + links) | both panels draw it for a signed-out reader |
| 13 | **Learn** — the circle, the learning path, the LeetCode pattern atlas, the concept index; `#step-<id>` entry from anywhere | D115, D117 | `/atlas/learn` | **Learn** (the sketch's stages on top, then this) | `/atlas/learn`, unchanged; every *Learn it* link still lands on its piece |
| 14 | **The readiness check** — your skills claimed → checked → built, an adaptive timed / extended / untimed check, the awareness summary | D142 | `/atlas/check` | **Your skills** (a slot) | `/atlas/your-skills`; `/atlas/check` still works and lights the panel. ⚠ D169's *Your skills* panel (List + Map) replaces the slot at merge |
| 15 | **The peek** — D114's popup on a term inside a posting (meaning, postings, you, Learn it, first resource) | D114, D118 P1 | in the postings, `/api/atlas/peek/:slug` | stays in the postings · **Glossary** shows the same meaning | the popup is unchanged; its meaning now comes from `meaningOf`, the one source the Glossary reads too |
| 16 | **The definitions and their sources** — a curator's definition, a drafted one accepted in Admin (D105 P11), else Wikipedia's first sentence marked *From Wikipedia (CC BY-SA)* | D105 P4 / P11 | node pages and the popup | **Glossary** (every term, with its source mark) · the node page | `/atlas/glossary`; *Open in Atlas* opens the node page |
| 17 | **Skill tags linked to their pages** (job card, ATS report, deck, tools page, Profile) | D105 P5 | `/api/atlas/resolve` | stays where the tags are · links open in **Roles and skills** | unchanged |
| 18 | **A role against your résumé** (have / missing, covers N of M) | A111 P3 | the posting's match | stays in the posting · links to **Roles and skills** | unchanged |
| 19 | **The audit's role card** (open now, new this week, pay p25–p75 or why hidden, the top 3 must-haves) — API only until now | D150 T04 | `/api/audit/roles`, `/api/audit/role/:slug` | **The audit** (the card) · **This week's market** (the counts) | `/atlas/the-audit`, `/atlas/this-weeks-market` |
| 20 | **The curator's tools behind Admin** — Admin → Data → Atlas (drafts and publishing, readiness, the editor, merge, edges, resources, the link check, Wikipedia refresh / find / redirects, drafted definitions export / import / review, the auto-publish run), Learn import, the circle's data, the sandbox, Readiness questions, the Question bank | D105 P6–P11, D117, D142, D150 T02 | `/admin` | **stay in Admin** (curator-only, not a reader's panel) | unchanged; an admin is sent to `/admin` and never sees `/app/atlas` |
| 21 | **The link-event counts** (opens and visits from postings, a number only) | D114 P5 | `/api/atlas/link-event` | unchanged (no screen) | — |
| 22 | **The public mount** (signed out, with the marketing dock and footer) | D105 P4 | `/atlas/*` | the same navigation | a signed-in reader is still taken to `/app/atlas…` |

**D172 (3), 11-07 — Your run.** **Your run** (You, first): your level, points from proof only (services/atlas/points.js, migration 226), streak, this week and today's quests; nothing in rows 1–22 moves.

**D172 (2), 11-07 — the Library.** **Library** (Grow, first) is the sketch's shelf of courses; `/atlas/library/<course>` is a course page: modules → lessons, each lesson its curated links with their source (D176-3) and its check, opening the lesson's Learn page (`#step-<id>`). The first course is the owner's path, *From silicon to software* (8 parts = modules, 108 steps = lessons) — every curated item mapped; nothing in rows 1–22 moves.

## Panels whose feature is not built yet — what they show instead (no made-up numbers)

| Panel | Not built yet | Shows today |
|---|---|---|
| Overview | the practice streak (D154) | stat cards only from data that exists: skills checked or built (D142), roles you cover enough to apply to now and skills on your route (D143); the next step; Today's question points to the check |
| Your skills | D169's List + Map panel | D142's check (the slot) |
| Your route | the sketch's stacked tiers (D150 P5) | the navigator (D143), or what it needs before it can point the way |
| How it works | each approved deck's idea as one flow (A154, 45o — the D172 sketch) | one card per idea, its parts in order, opening its deck |
| Today's question | the daily question (D154) | an honest line and *Check a skill* (D142 serves the bank today) |
| The audit | the audit's questions and result (D150) | the role picker and the role card (D150 T04) |
| This week's market | the weekly read (D150 T09–T11) | the auditable roles' open postings and new-in-7-days counts (the role card's own numbers) |
| Learn | the owner's own idea for courses (a new row when he gives it) | built as sketched: one stage per part of *From silicon to software* with its earned progress, then the full Learn view |

## Reserved addresses

A panel id is a reserved slug, like `learn` and `check` before it: `overview`, `your-map`, `your-skills`, `your-route`,
`your-run`, `library` (and `library/<course>`), `learn`, `todays-question`, `the-audit`, `roles-and-skills`, `this-weeks-market`, `glossary` (+ the alias `check`). A node
whose name slugs to one of these would be shadowed by the panel; the ids were chosen so no plausible node name does.

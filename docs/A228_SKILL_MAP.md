# A228 · The skill map as a product (46r, owner 11-16)

> *"atlas and skill mapping, how we help users to understand their skill map. their skill gaps how we show this and where
> they are against the market, how we can help close these gaps and also pivot if they want to. all of these are a product
> initself and have not been address enough, and they are not graphical and meaningful enough"* — the owner, 11-16.

Status: **the sketches are ready for the owner's pick** (D149 rule 3). Nothing is built yet.
`docs/sketches/A228-concepts.html` (index) · `A228-a-map.html` · `A228-b-readout.html` · `A228-c-route.html`
(shared `A228-common.js` / `.css`). The private Artifact link is in the WORKLOG.

## 1. The five questions

The product answers five questions. Each answer is **shown** as a graphic, and every number is **counted**: no model
is called (D190).

| # | The person asks | The answer is one number | What they can do from it |
|---|---|---|---|
| Q1 | What do I have, and how strongly have I shown it? | Skills proven / on the résumé / not yet | Prove a claimed skill (check, build) |
| Q2 | What does my target role ask that I lack? | The share of the role's postings that ask for each missing skill | Open the skill in the Library |
| Q3 | Where do I stand against the market? | **Postings within reach**: open postings where I have ≥ 60% of what they ask, by level | Apply now to the ones in reach (the board, filtered) |
| Q4 | How do I close the gap? | The postings each next skill adds, in the shortest order (postings gained per hour) | Start the next step; see the jobs it opens |
| Q5 | Should I move sideways? | For each adjacent role: how much I've shown of what it asks, its open postings, hours to 30% within reach | Change the aim; the board follows |

**Who asks, when:**
- **A newcomer** (résumé just in): Q1, then Q3. Lead with the one number, with no setup.
- **An applicant** (the board is their day): Q3 and Q4. The number goes up as they prove things, and they can see why.
- **A pivoter**: Q5 first, then Q2 and Q4 for the role they pick.

## 2. What draft shows today (inventory, 46r)

About 25 surfaces touch these questions (the full table is in the appendix; seed docs `D167_ATLAS_MAP.md`,
`D178_ATLAS_INVENTORY.md`, `ATLAS_BOUNDARY.md`). In summary:

- **Q1 and Q4 are covered many times over.** Q1 appears in the market tree, the Your skills ring map, the families
  list, the skills list, Profile and Tiny. The next step is computed four ways: `directionLine`, `navigator.next`, the
  track board's start line, and Your course's "Continue".
- **Q2 is answered well once:** RoleReadiness (must / common / nice, with demand bars and "what moves your % most").
  Elsewhere it is text.
- **Q3 is answered nowhere.** No surface places the person on the distribution of postings, and none does it by level
  (readiness is hard-coded to all levels, `roleReadiness.js:61`). The only per-level self-versus-bar reading is the
  6-question audit bar.
- **Q5 is text only:** the Navigator's "Changing fields" and Branches. Compare roles comes closest (up to four dials).
  The pivot cost is a constant (`WEEKS_PER_SKILL`, which the UI says is not a measurement), and no market size sits
  beside a pivot line.
- **Duplicates (A93):**
  - Three definitions of "have for a role": `requires` edges with a 60% bar on the role page; the board's top 15 in
    roleFitReading; `requires` coverage in Branches. One role can read "partial", "42% ready" and "covers 9 of 15" at
    once.
  - Two skill maps of the same data: the radial tree and the Your skills ring.
  - Two quick-check engines mounted together (D169 `skill_quick_checks`, D142 `readiness_checks`).
  - "Proven N of their top M" cut at 12 on the company page and at 8 in the extension.
  - Next-level gaps drawn four ways.

## 3. The data, honestly (D190: no model)

| Needed for | draft holds | Fill (measured 46r) |
|---|---|---|
| Per-posting asks (Q2–Q5) | `atlas_posting_match.asked` (node ids per posting), `job_tech` | 100k synthetic fixture: 87% of postings have asks, 87% a role. Production: ⚠ not measured (DB reads refused) |
| The posting's level (Q3 by level) | `scraped_jobs.level_read` (D106), copied into `atlas_posting_match.level` → `atlas_role_level_stats` | **0% in both local fixtures** (`board_level_read` = 0): neither fills `level_read`. Production: ⚠ unknown, the owner's read. The by-level split depends on it |
| Role demand per skill (Q2) | `atlas_role_level_stats` (role × level × node), `atlas_node_stats` | 311 rows, level "" only, in the fixture |
| Your states (Q1) | `profile_skills` (claimed), `skill_proofs` + `skill_quick_checks` + `readiness_checks` + `learn_builds` (proven) | 0 in the fixture: no résumé-holding users. Proof dates exist; **claimed skills carry no date** (`profile_skills` has no recency column) |
| Hours to a proof (Q4, Q5) | `atlas_resources.hours` | 121 resources (all `practice`) |
| Is a gap growing? | `risingSkills.js` (Admin only), the stack-exposure trend (buried in Today's question) | Not on any personal surface |
| Pay per skill | `atlas_node_stats.pay_*` | 76 of 2,072 nodes in the fixture |

**What the build would add:**
1. **One reading of "within reach"**: a posting's asks met, weighted by proof (proven 1, on the résumé ½, last used
   before 2024 ¼). It runs over the live `atlas_posting_match` rows, never a whole-board scan per request (memory:
   board reads freeze the site). A per-user cache would be refreshed when the person's skills change.
2. **The distribution**: a 10-bin histogram per role (and per level where `level_read` is filled), computed from the
   same rows.
3. **The route**: greedy by postings gained per hour, using `atlas_resources.hours`.
4. **Recency for claimed skills** from the résumé's experience dates. Without it, "last used" cannot be shown.

## 4. The three concepts (sketches)

All three share one model and differ in what leads. Each was shot in Dusk Light / Dusk Dark / Plain Light / Plain
Dark at 1920 and 400 px (`tmp/a228/shots/`): no page errors and no horizontal scroll. Every chart has hover and focus
tooltips and a "Show as a table" view. The states are one hue: proven solid, on the résumé hatched, not yet a dashed
outline. Colour is never the only cue: the legend names each state and each tooltip says it in words. The palette ran
through the dataviz validator: contrast ≥ 3:1 in all four themes. Plain Dark's chart grey moved to `#6B7280` (ΔE 23
from the accent; its INFO token `#8B939C` read ΔE 14, a hard fail), so the build needs a chart-neutral token there.

| | A · One map | B · The readout | C · The route |
|---|---|---|---|
| Leads with | A treemap of your skills by family. Area = how many postings ask; fill = your state | One number: postings within reach, with level tiles | The station line from you to the aim; each column = postings within reach once that skill is proven |
| Q3 | A small histogram beside the map | A large histogram + level tiles | The route's first column |
| Q5 | A role switch resizes the same map | A scatter: shown × open postings, bubble = hours | Small multiples, one per role, on one scale |
| Replaces | The market tree, the ring map, the families list | The readiness dial, Compare roles, the five sections | The track board, the Navigator cards, Compare roles |

## 5. Build rules once picked

The A93 rules apply: one shared piece per graphic (`SkillTreemap`, `ReachHistogram`, `RouteSteps`, `RoleScatter` /
`RoleMultiples`, whichever the pick needs) and one "within reach" server reader, which replaces the three "have"
definitions. ⛔ No pills (D60). FULL WIDTH (BRAND.md): charts grow into the width. Tokens only
(`colorLiteralGuard`). Phone layouts. Reduced motion. No model call (D190). Fidelity tests against the sketch.
Measure at production size before pushing (memory: an empty-DB boot misses scale).

## Appendix · the inventory (46r, read from the code; ●● good · ● partial · ○ weak)

| Surface | File | Answers | What it draws | Data |
|---|---|---|---|---|
| Your run | `atlas/YourRun.jsx` | Q1○ Q4● | SVG level ring (points), 4-week grid, quests, "N open jobs ask for X" | `/api/atlas/run`, `/api/atlas/unlocks` (job_tech × job_taxonomy) |
| Track board | `atlas/TrackBoard.jsx` | Q4●● | SVG track You → goal, stations, "N open roles" | `/api/navigator` |
| Navigator | `atlas/Navigator.jsx` | Q4●● Q5● | Text cards, ordered lists, ≈ weeks (a constant) | `/api/navigator` |
| Market tree | `atlas/AtlasTree.jsx`, `YourMap.jsx` | Q1●● Q2● Q4● | Radial SVG tree: families as sectors, square = √postings | `/api/atlas/me` (a full scraped_jobs scan per build, `atlasTree.js:55`) |
| Five sections | `YourMap.jsx:16-58` | Q2● Q5● Q4● | Chip rows with small CSS bars | `/api/atlas/me` (used_with, requires) |
| Families list | `YourMap.jsx:77-91` | Q1● | Text: "2 proven · 3 claimed · of 8" | `/me` |
| Your course | `atlas/YourCourse.jsx` | Q4● | SVG circle of 108 pieces | `/api/learn/*` |
| For a role | `atlas/RoleReadiness.jsx` | Q2●● Q4●● Q3○ | SVG dial; must / common / nice leaves with demand bars; ranked moves | `/api/atlas/readiness` (all levels, hard-coded) |
| Compare roles | `atlas/CompareRoles.jsx` | Q5●● Q2● | Up to 4 dials + a grid of dots | `/api/atlas/readiness/compare` |
| Your skills list | `atlas/YourSkillsPanel.jsx:91-131` | Q1●● | Rows: state dot + word, proof, Check it / Add proof | `/api/your-skills` |
| Your skills ring | `atlas/YourSkillsPanel.jsx:22-71` | Q1● Q2○ Q5○ | SVG: You at centre, rings of skills | `/api/your-skills/map` (= computeYourMap re-shaped) |
| Readiness check | `atlas/ReadinessCheck.jsx` | Q1● | Quiz + concept summary | `/api/readiness*` |
| Overview | `atlas/AtlasPanels.jsx:55-117` | Q1○ Q4○ | Stat tiles | `/me`, `/navigator`, `/readiness` |
| Skill page | `atlas/AtlasPage.jsx:201-353`, `AtlasGraph.jsx` | Q1● Q5○ | Headline number, panes, first-ring SVG graph, pay | `/api/atlas/node/:slug` |
| Role page | same + RoleBoard / RoleNextLevel | Q2● Q3○ | Text lists with %, levels with counts | `/node/:slug`, `atlas_role_level_stats` |
| Family page | `YourMap.jsx:161-183` | Q1● | SVG tree | `/api/atlas/tree/family/:key` |
| This week's market / audit card | `AtlasPanels.jsx:381-501` | market only | Text + stat tiles | `/api/audit/*` |
| Stack exposure | `AtlasPanels.jsx:225-239` | Q1● Q3● | Collapsed text list | `/api/learn/stack-exposure` |
| Practice progress | `AtlasPanels.jsx:206-222` | Q1○ | Text | `/api/learn/practice-progress` |
| Compete | `atlas/CompetePanels.jsx` | Q3○ | Lists / quiz (off by default) | `/api/atlas/league`, `/bar/:code` |
| Library / Learn | `LibraryPanel.jsx`, `LearnView.jsx`, `LearnCircle.jsx`, `LearnWheel.jsx` | Q4○ | SVG ring, card wheel | `/api/learn/*` |
| Company page | `companies/CompanyPage.jsx:153` | Q2● | "Proven N of their top 12" | `/api/companies/:slug/match` |
| Extension side panel | `extension/panelModel.js:9` | Q2○ | One line, top 8 (the company's stack, not the posting's) | `companyMatchFor` |
| Deck card | `lib/deckCardFacts.js:104` | Q2○ | "N of M skills matched" (ATS keywords, not Atlas) | the dealt card |
| Profile | `profile/YourProfile.jsx:324-366` | Q1● Q2● | Two text columns, "N% ready" | `profilePage.js` |
| Tiny | `lib/assistantDraft.js`, `services/assistant/assistant.js` | Q1● Q2○ | Chat text (T2) | yourSkillStates |

Unused today: `GET /api/atlas/role-fit` has no client caller left. The `leads_to` / `alternative_to` / `part_of`
edges feed no personal surface. `risingSkills.js` feeds Admin only.
